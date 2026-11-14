import archiver from 'archiver';
import bcrypt from 'bcryptjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import rateLimit from 'express-rate-limit';

const safeKey = value => String(value || '').replace(/^\\/+/, '').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
const ignoredPath = relative => {
  const parts = relative.split(path.sep);
  return parts.some(part =>
    part === '.git' || part === 'node_modules' || part === '.next' ||
    part === '.cache' || part === 'coverage' || part === '.vercel' ||
    part === '.render' || part === 'dist' || part === 'build'
  ) || parts.some(part => part === '.env' || part.startsWith('.env.'));
};
const challenge = res => {
  res.set('WWW-Authenticate', 'Basic realm="PonudiMi rezervna kopija", charset="UTF-8"');
  return res.status(401).json({ error: 'Unesi administratorski email i lozinku za preuzimanje rezervne kopije.' });
};

export function registerBackupExport({ app, pool, isPlatformAdmin, uploadDir, s3, s3Enabled, filesystemStorage, repoRoot }) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Previše pokušaja izvoza. Sačekaj 15 minuta.' }
  });

  const authenticateBackupAdmin = async (req, res, next) => {
    try {
      const header = String(req.headers.authorization || '');
      if (!header.startsWith('Basic ')) return challenge(res);
      let decoded = '';
      try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return challenge(res); }
      const separator = decoded.indexOf(':');
      if (separator < 1) return challenge(res);
      const email = decoded.slice(0, separator).trim().toLowerCase();
      const password = decoded.slice(separator + 1);
      if (!email || !password || password.length > 1024) return challenge(res);
      const found = await pool.query('SELECT id,email,password_hash FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
      const user = found.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) return challenge(res);
      if (!(await isPlatformAdmin({ sub: user.id, email: user.email }))) {
        return res.status(403).json({ error: 'Izvoz je dozvoljen samo administratoru platforme.' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/admin/backup/export', limiter, authenticateBackupAdmin, async (req, res, next) => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ponudimi-backup-'));
    const dumpPath = path.join(tempDir, 'ponudimi-database.dump');
    let archive;
    let finished = false;
    const cleanup = () => fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
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

      const stat = await fs.promises.stat(dumpPath);
      if (!stat.size) throw new Error('PostgreSQL je vratio praznu rezervnu kopiju.');

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
      ].join('\n');
      await fs.promises.writeFile(readmePath, readme, { mode: 0o600 });

      res.status(200);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="ponudimi-rezervna-kopija.zip"',
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff'
      });
      archive = archiver('zip', { zlib: { level: 1 } });
      archive.on('warning', error => { if (error.code !== 'ENOENT') archive.destroy(error); });
      archive.on('error', error => { if (!res.headersSent) next(error); else res.destroy(error); });
      archive.on('end', () => { finished = true; });
      res.on('close', () => { if (!finished) archive?.abort(); void cleanup(); });
      archive.pipe(res);
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
      res.once('finish', () => { void cleanup(); });
    } catch (error) {
      await cleanup();
      if (res.headersSent) return res.destroy(error);
      next(error);
    }
  });
}
