import archiver from 'archiver';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import yauzl from 'yauzl';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const safeKey = value => String(value || '').replace(/^\/+/, '').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
const ignoredPath = relative => {
  const parts = relative.split(path.sep);
  return parts.some(part =>
    part === '.git' || part === 'node_modules' || part === '.next' ||
    part === '.cache' || part === 'coverage' || part === '.vercel' ||
    part === '.render' || part === 'dist' || part === 'build'
  ) || parts.some(part => part === '.env' || part.startsWith('.env.'));
};
const unauthorized = res => res.status(401).json({ error: 'Sesija je istekla. Prijavi se ponovo kao administrator.' });

export function registerBackupExport({ app, pool, isPlatformAdmin, uploadDir, s3, s3Enabled, filesystemStorage, repoRoot }) {
  const authenticateBackupAdmin = async (req, res, next) => {
    try {
      const header = String(req.headers.authorization || '');
      const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token || !process.env.JWT_SECRET) return unauthorized(res);
      let claims;
      try { claims = jwt.verify(token, process.env.JWT_SECRET); } catch { return unauthorized(res); }
      if (!claims?.sub || !claims?.email) return unauthorized(res);
      const found = await pool.query('SELECT id,email FROM users WHERE id=$1 AND lower(email)=lower($2) LIMIT 1', [claims.sub, claims.email]);
      const user = found.rows[0];
      if (!user) return unauthorized(res);
      if (!(await isPlatformAdmin({ sub: user.id, email: user.email }))) {
        return res.status(403).json({ error: 'Izvoz je dozvoljen samo administratoru platforme.' });
      }
      req.backupAdmin = user;
      next();
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/admin/backup/export', authenticateBackupAdmin, async (req, res, next) => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ponudimi-backup-'));
    const dumpPath = path.join(tempDir, 'ponudimi-database.dump');
    const zipPath = path.join(tempDir, 'ponudimi-rezervna-kopija.zip');
    try {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nije podešen na API servisu.');
      await new Promise((resolve, reject) => {
        const child = spawn('pg_dump', [
          '--format=custom', '--no-owner', '--no-acl',
          '--file', dumpPath, process.env.DATABASE_URL
        ], { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { if (stderr.length < 12000) stderr += chunk.toString(); });
        child.once('error', error => reject(error.code === 'ENOENT'
          ? new Error('Na Render servisu nije instaliran pg_dump. Potrebno je dodati PostgreSQL client pre izvoza.')
          : error));
        child.once('close', code => code === 0 ? resolve() : reject(new Error('PostgreSQL izvoz nije uspeo: ' + stderr.slice(0, 1500))));
      });

      const dumpStat = await fs.promises.stat(dumpPath);
      if (!dumpStat.size) throw new Error('PostgreSQL je vratio praznu rezervnu kopiju.');

      const schemaPath = path.join(repoRoot, 'standalone', 'db', 'init.sql');
      const catalogPath = path.join(repoRoot, 'standalone', 'api', 'business-catalog.mjs');
      const readmePath = path.join(tempDir, 'UPUTSTVO-ZA-VRACANJE.txt');
      const readme = [
        'PONUDIMI — REZERVNA KOPIJA',
        '',
        'Sadržaj:',
        '- database/ponudimi-database.dump: PostgreSQL dump sa strukturom, svim tabelama, podacima, indeksima i sekvencama.',
        '- database/init.sql: osnovna šema aplikacije.',
        '- application/: izvorni kod aplikacije (bez tajni, .env fajlova i node_modules).',
        '- uploads/: lokalne fotografije, ako se koristi lokalno skladište.',
        '- storage/s3/: objekti iz S3/R2 skladišta, ako je ono podešeno.',
        '',
        'VRAĆANJE BAZE:',
        '1. Instalirati PostgreSQL client alate (pg_restore).',
        '2. Napraviti praznu PostgreSQL bazu i podesiti DATABASE_URL.',
        '3. Pokrenuti: pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" database/ponudimi-database.dump',
        '4. Podesiti potrebne promenljive okruženja na novom serveru. Tajne nisu uključene u ovu arhivu.',
        '5. Instalirati zavisnosti aplikacije i pokrenuti API iz application/standalone/api.',
        '',
        'VAŽNO: Sačuvati JWT_SECRET i ostale produkcione tajne odvojeno i bezbedno. Ovaj ZIP ih namerno ne sadrži.',
        'Ako se koristi S3/R2, podesiti odgovarajuće S3 promenljive i prebaciti sadržaj storage/s3/ u isti bucket/key raspored.',
        'Ako se koristi lokalno skladište, kopirati sadržaj uploads/ u putanju UPLOAD_DIR na novom serveru.',
        ''
      ].join('\\n');
      await fs.promises.writeFile(readmePath, readme, { mode: 0o600 });

      const output = createWriteStream(zipPath, { flags: 'wx' });
      const archive = archiver('zip', { zlib: { level: 1 } });
      const archiveDone = new Promise((resolve, reject) => {
        output.once('close', resolve);
        output.once('error', reject);
        archive.once('error', reject);
      });
      archive.on('warning', error => {
        if (error.code !== 'ENOENT') archive.destroy(error);
      });
      archive.pipe(output);
      archive.file(dumpPath, { name: 'database/ponudimi-database.dump' });
      if (fs.existsSync(schemaPath)) archive.file(schemaPath, { name: 'database/init.sql' });
      if (fs.existsSync(catalogPath)) archive.file(catalogPath, { name: 'database/business-catalog-schema-and-routes.mjs' });
      archive.file(readmePath, { name: 'UPUTSTVO-ZA-VRACANJE.txt' });
      archive.directory(repoRoot, 'application', entry => {
        const relative = String(entry.name || '');
        if (!relative || ignoredPath(relative)) return false;
        if (relative === 'standalone/uploads' || relative.startsWith('standalone/uploads' + path.sep)) return false;
        return true;
      });

      if (filesystemStorage && fs.existsSync(uploadDir)) archive.directory(uploadDir, 'uploads');
      if (s3Enabled && s3) {
        let continuationToken;
        do {
          const page = await s3.send(new ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET,
            ContinuationToken: continuationToken
          }));
          for (const object of page.Contents || []) {
            const key = safeKey(object.Key);
            if (!key || !object.Key) continue;
            const item = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: object.Key }));
            if (item.Body) archive.append(item.Body, { name: 'storage/s3/' + key });
          }
          continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (continuationToken);
      }

      await archive.finalize();
      await archiveDone;
      const zipStat = await fs.promises.stat(zipPath);
      if (zipStat.size <= dumpStat.size || zipStat.size < 1024) {
        throw new Error('ZIP arhiva nije potpuna: veličina arhive nije očekivana. Izvoz nije poslat.');
      }

      res.set({
        'Content-Type': 'application/zip',
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        'X-Backup-Size': String(zipStat.size)
      });
      res.download(zipPath, 'ponudimi-rezervna-kopija.zip', error => {
        void fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        if (error && !res.headersSent) next(error);
        else if (error) res.destroy(error);
      });
    } catch (error) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      next(error);
    }
  });

  const restoreUpload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (/\\.zip$/i.test(file.originalname || '')) cb(null, true);
      else cb(new Error('Izaberi ZIP arhivu koju je napravio PonudiMi izvoz.'));
    }
  });

  const extractDatabaseDump = (zipPath, outputPath) => new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true, decodeStrings: true }, (openError, zip) => {
      if (openError) return reject(new Error('ZIP arhiva nije ispravna ili nije moguće da se otvori.'));
      let found = false;
      let settled = false;
      const fail = error => { if (settled) return; settled = true; reject(error); };
      zip.on('error', fail);
      zip.on('entry', entry => {
        if (entry.fileName !== 'database/ponudimi-database.dump') {
          zip.readEntry();
          return;
        }
        if (found || entry.fileName.endsWith('/') || entry.uncompressedSize < 1 || entry.uncompressedSize > 2 * 1024 * 1024 * 1024) {
          return fail(new Error('Datoteka baze u ZIP arhivi nije dozvoljene veličine ili formata.'));
        }
        found = true;
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail(streamError);
          pipeline(stream, createWriteStream(outputPath, { flags: 'wx' }))
            .then(() => { if (!settled) { settled = true; resolve(entry.uncompressedSize); } })
            .catch(fail);
        });
      });
      zip.on('end', () => { if (!found) fail(new Error('ZIP ne sadrži database/ponudimi-database.dump. Izaberi PonudiMi rezervnu kopiju.')); });
      zip.readEntry();
    });
  });

  app.post('/api/admin/backup/import', authenticateBackupAdmin, restoreUpload.single('backup'), async (req, res, next) => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ponudimi-restore-'));
    const dumpPath = path.join(tempDir, 'ponudimi-database.dump');
    try {
      if (!req.file) return res.status(400).json({ error: 'Izaberi ZIP arhivu za uvoz.' });
      const dumpSize = await extractDatabaseDump(req.file.path, dumpPath);
      const tables = await pool.query(
        "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name"
      );
      const quoteIdent = value => '"' + String(value).replace(/"/g, '""') + '"';
      for (const table of tables.rows) {
        const existing = await pool.query(
          'SELECT EXISTS (SELECT 1 FROM ' + quoteIdent(table.table_schema) + '.' + quoteIdent(table.table_name) + ' LIMIT 1) AS has_rows'
        );
        if (existing.rows[0]?.has_rows) {
          return res.status(409).json({
            error: 'Uvoz je zaustavljen radi zaštite podataka: ciljna baza već sadrži zapise. Uvoz je dozvoljen samo u praznu bazu na novom serveru. Postojeći podaci nisu menjani.'
          });
        }
      }
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nije podešen na API servisu.');
      await new Promise((resolve, reject) => {
        const child = spawn('pg_restore', [
          '--clean', '--if-exists', '--no-owner', '--no-acl',
          '--single-transaction', '--exit-on-error',
          '--dbname', process.env.DATABASE_URL, dumpPath
        ], { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { if (stderr.length < 12000) stderr += chunk.toString(); });
        child.once('error', error => reject(error.code === 'ENOENT'
          ? new Error('Na API servisu nije instaliran pg_restore. Instaliraj PostgreSQL client alate.')
          : error));
        child.once('close', code => code === 0 ? resolve() : reject(new Error('Uvoz baze nije uspeo. Transakcija je poništena; postojeći podaci nisu promenjeni. ' + stderr.slice(0, 1200))));
      });
      return res.json({
        ok: true,
        message: 'Baza je uspešno uvezena. Pre ponovnog korišćenja proveri prijavu, oglase, zahteve i fotografije.',
        dump_size: dumpSize
      });
    } catch (error) {
      next(error);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      if (req.file?.path) await fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    }
  });
}
