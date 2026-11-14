import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { rateLimit } from 'express-rate-limit';

const quoteIdentifier = value => '"' + String(value).replace(/"/g, '""') + "'";

export function registerBackupExport({ app, pool, auth, admin, asyncRoute }) {
  const exportLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 2,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Izvoz je već pokrenut. Pokušaj ponovo kasnije.' }
  });

  app.get('/api/admin/backup/export', auth, admin, exportLimit, asyncRoute(async (req, res) => {
    const client = await pool.connect();
    let stream;
    let gzip;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const db = await client.query('SELECT current_database() AS name, now() AS created_at');
      const tablesResult = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
      );
      const tables = tablesResult.rows.map(row => row.table_name);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.status(200);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', 'attachment; filename="ponudimi-backup-' + stamp + '.json.gz"');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      async function* exportJson() {
        try {
          yield '{"format":"ponudimi-postgres-json-v1","database":' + JSON.stringify(db.rows[0].name) +
            ',"created_at":' + JSON.stringify(db.rows[0].created_at) + ',"tables":[';
          for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
            const table = tables[tableIndex];
            const quoted = quoteIdentifier(table);
            const countResult = await client.query('SELECT count(*)::bigint AS count FROM public.' + quoted);
            const rowCount = Number(countResult.rows[0].count);
            if (tableIndex) yield ',';
            yield '{"name":' + JSON.stringify(table) + ',"row_count":' + rowCount + ',"rows":[';
            let offset = 0;
            let firstRow = true;
            while (offset < rowCount) {
              const batch = await client.query(
                'SELECT COALESCE(jsonb_agg(to_jsonb(batch_row)), \'[]\'::jsonb) AS rows ' +
                'FROM (SELECT * FROM public.' + quoted + ' ORDER BY ctid LIMIT $1 OFFSET $2) AS batch_row',
                [100, offset]
              );
              const rows = batch.rows[0]?.rows || [];
              if (!rows.length) break;
              for (const row of rows) {
                if (!firstRow) yield ',';
                yield JSON.stringify(row);
                firstRow = false;
              }
              offset += rows.length;
            }
            yield ']}';
          }
          yield ']}';
          await client.query('COMMIT');
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch {}
          throw error;
        } finally {
          client.release();
        }
      }

      stream = Readable.from(exportJson());
      gzip = createGzip({ level: 6 });
      stream.on('error', error => {
        console.error('PonudiMi backup export stream failed:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Izvoz baze nije uspeo.' });
        else res.destroy(error);
      });
      gzip.on('error', error => {
        console.error('PonudiMi backup compression failed:', error);
        res.destroy(error);
      });
      stream.pipe(gzip).pipe(res);
      req.on('close', () => {
        if (!res.writableEnded) {
          stream.destroy();
          gzip.destroy();
        }
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      client.release();
      throw error;
    }
  }));
}
