import archiver from 'archiver';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash } from 'node:crypto';
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

const ignoredDirectories = new Set([
  '.git', 'node_modules', '.next', '.cache', 'coverage', '.vercel', '.render',
  'dist', 'build', 'backups', 'backup', 'tmp', 'temp', 'test-results',
  'playwright-report', 'secrets', '.ssh',
]);
const ignoredFiles = new Set([
  '.npmrc', '.pypirc', 'credentials.json', 'service-account.json',
  'id_rsa', 'id_ed25519',
]);
const ignoredPath = relative => {
  const parts = String(relative || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const name = (parts[parts.length - 1] || '').toLowerCase();
  return parts.some(part => ignoredDirectories.has(part) || part.startsWith('.env')) ||
    ignoredFiles.has(name) || /\.(pem|key|p12|pfx)$/i.test(name);
};
const unauthorized = res => res.status(401).json({ error: 'Sesija je istekla. Prijavi se ponovo kao administrator.' });

async function appendDirectoryContents(archive, sourceDir, archivePrefix, relativeBase = '', excludedRoot = null) {
  let entries;
  try {
    entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { files: 0, bytes: 0 };
    throw error;
  }
  let files = 0;
  let bytes = 0;
  const excluded = excludedRoot ? path.resolve(excludedRoot) : null;
  for (const entry of entries) {
    const relative = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
    const normalized = relative.split(path.sep).join('/');
    if (ignoredPath(normalized)) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const absolutePath = path.resolve(sourcePath);
    if (excluded && (absolutePath === excluded || absolutePath.startsWith(excluded + path.sep))) continue;
    if (entry.isDirectory()) {
      const nested = await appendDirectoryContents(archive, sourcePath, archivePrefix, relative, excluded);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      const stat = await fs.promises.stat(sourcePath);
      archive.file(sourcePath, { name: path.posix.join(archivePrefix, normalized) });
      files += 1;
      bytes += stat.size;
    }
  }
  return { files, bytes };
}

function pgEnvironment(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL nije podešen na API servisu.');
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL nije PostgreSQL URL.');
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!url.hostname || !url.username || !database) throw new Error('DATABASE_URL nije kompletan.');
  const env = {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'ponudimi-backup-export',
  };
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode) env.PGSSLMODE = sslMode;
  else if (process.env.DATABASE_SSL === 'true') env.PGSSLMODE = 'require';
  return env;
}

function captureCommand(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { if (stdout.length < 12000) stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { if (stderr.length < 12000) stderr += chunk.toString(); });
    child.once('error', error => reject(error.code === 'ENOENT'
      ? new Error('Nedostaje PostgreSQL client alat: ' + command + '.')
      : error));
    child.once('close', code => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(stderr.trim() || command + ' nije uspeo (kod ' + code + ').'));
    });
  });
}

async function pgToolVersions(pool, env) {
  const [dump, restore, server] = await Promise.all([
    captureCommand('pg_dump', ['--version'], env),
    captureCommand('pg_restore', ['--version'], env),
    pool.query("SELECT current_setting('server_version_num')::int AS version_num, current_setting('server_version') AS version"),
  ]);
  const dumpMajor = Number(dump.stdout.match(/(\d+)(?:\.\d+)?/)?.[1]);
  const restoreMajor = Number(restore.stdout.match(/(\d+)(?:\.\d+)?/)?.[1]);
  const serverVersionNum = Number(server.rows[0]?.version_num);
  const serverMajor = Math.floor(serverVersionNum / 10000);
  if (!dumpMajor || !restoreMajor || !serverMajor) throw new Error('Nije moguće utvrditi verzije PostgreSQL alata i servera.');
  if (dumpMajor < serverMajor || restoreMajor < serverMajor) {
    throw new Error('PostgreSQL server je verzije ' + serverMajor + ', a dostupni alati su pg_dump ' + dumpMajor + ' i pg_restore ' + restoreMajor + '. Potrebna je verzija klijentskih alata najmanje ' + serverMajor + '. Izvoz/uvoz je zaustavljen bez izmene baze.');
  }
  return { pgDumpVersion: dump.stdout, pgRestoreVersion: restore.stdout, serverVersion: server.rows[0].version, env };
}

const requireFeature = (key, label) => (_req, res, next) => {
  if (process.env[key] !== 'true') return res.status(503).json({ error: label + ' je trenutno isključen.' });
  next();
};

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

  const exportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 2, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: req => req.backupAdmin?.id ? 'backup-admin:' + req.backupAdmin.id : ipKeyGenerator(req.ip), message: { error: 'Dostignuto je ograničenje od dva izvoza u jednom satu.' } });
  const importLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 1, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: req => req.backupAdmin?.id ? 'backup-admin:' + req.backupAdmin.id : ipKeyGenerator(req.ip), message: { error: 'Dostignuto je ograničenje od jednog uvoza u jednom satu.' } });

  app.get('/api/admin/backup/export', authenticateBackupAdmin, requireFeature('ENABLE_ADMIN_BACKUP_EXPORT', 'Izvoz baze'), exportLimiter, async (req, res, next) => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ponudimi-backup-'));
    const dumpPath = path.join(tempDir, 'ponudimi-database.dump');
    const zipPath = path.join(tempDir, 'ponudimi-rezervna-kopija.zip');
    try {
      const pgEnv = pgEnvironment(process.env.DATABASE_URL);
      const toolVersions = await pgToolVersions(pool, pgEnv);
      await new Promise((resolve, reject) => {
        const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', dumpPath], { env: pgEnv, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { if (stderr.length < 12000) stderr += chunk.toString(); });
        child.once('error', error => reject(error));
        child.once('close', code => code === 0 ? resolve() : reject(new Error('PostgreSQL izvoz nije uspeo: ' + stderr.slice(0, 1500))));
      });

      const dumpStat = await fs.promises.stat(dumpPath);
      if (!dumpStat.size) throw new Error('PostgreSQL je vratio praznu rezervnu kopiju.');
      await captureCommand('pg_restore', ['--list', dumpPath], pgEnv);

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
        '- storage/s3-objects/ i storage/s3-index.json: objekti iz S3/R2 skladišta sa mapom originalnih ključeva.',
        '',
        'VRAĆANJE BAZE:',
        '1. Instalirati PostgreSQL client alate (pg_restore).',
        '2. Napraviti praznu PostgreSQL bazu i podesiti DATABASE_URL.',
        '3. Pokrenuti: pg_restore --clean --if-exists --no-owner --no-acl --dbname=NAZIV_NOVE_BAZE database/ponudimi-database.dump',
        '4. Podesiti potrebne promenljive okruženja na novom serveru. Tajne nisu uključene u ovu arhivu.',
        '5. Instalirati zavisnosti aplikacije i pokrenuti API iz application/standalone/api.',
        '',
        'VAŽNO: Sačuvati JWT_SECRET i ostale produkcione tajne odvojeno i bezbedno. Ovaj ZIP ih namerno ne sadrži.',
        'Ako se koristi S3/R2, podesiti odgovarajuće S3 promenljive i vratiti objekte iz storage/s3-objects/ prema original_key vrednostima u storage/s3-index.json.',
        'Ako se koristi lokalno skladište, kopirati sadržaj uploads/ u putanju UPLOAD_DIR na novom serveru.',
        ''
      ].join('\n');
      await fs.promises.writeFile(readmePath, readme, { mode: 0o600 });

      const output = createWriteStream(zipPath, { flags: 'wx', mode: 0o600 });
      const archive = archiver('zip', { zlib: { level: 1 } });
      const archiveDone = new Promise((resolve, reject) => {
        output.once('close', resolve);
        output.once('error', reject);
        archive.once('error', reject);
        archive.once('warning', reject);
      });
      archiveDone.catch(() => {});
      archive.pipe(output);
      archive.file(dumpPath, { name: 'database/ponudimi-database.dump' });
      if (fs.existsSync(schemaPath)) archive.file(schemaPath, { name: 'database/init.sql' });
      if (fs.existsSync(catalogPath)) archive.file(catalogPath, { name: 'database/business-catalog-schema-and-routes.mjs' });
      archive.file(readmePath, { name: 'UPUTSTVO-ZA-VRACANJE.txt' });
      // Dodaj fajlove pojedinačno. Archiver.directory() filter u Node 26
      // vraćao je nevažeći objekat na Renderu i prekidao ZIP sa 500 odgovorom.
      const applicationStats = await appendDirectoryContents(archive, repoRoot, 'application', '', uploadDir);
      if (!applicationStats.files) throw new Error('Izvorni kod aplikacije nije pronađen; ZIP nije napravljen.');
      const uploadStats = filesystemStorage && fs.existsSync(uploadDir)
        ? await appendDirectoryContents(archive, uploadDir, 'uploads')
        : { files: 0, bytes: 0 };
      const r2Index = [];
      if (s3Enabled && s3) {
        let continuationToken;
        do {
          const page = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, ...(continuationToken ? { ContinuationToken: continuationToken } : {}) }));
          for (const object of page.Contents || []) {
            if (!object.Key) continue;
            const item = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: object.Key }));
            if (!item.Body) throw new Error('S3/R2 objekat nema sadržaj: ' + object.Key);
            const archivePath = 'storage/s3-objects/' + createHash('sha256').update(object.Key).digest('hex');
            archive.append(item.Body, { name: archivePath });
            r2Index.push({ original_key: object.Key, archive_path: archivePath, size: object.Size ?? null, etag: object.ETag ?? null, last_modified: object.LastModified ? object.LastModified.toISOString() : null, content_type: item.ContentType || 'application/octet-stream' });
          }
          if (page.IsTruncated && !page.NextContinuationToken) throw new Error('S3/R2 lista objekata nije kompletna; nedostaje continuation token.');
          continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (continuationToken);
      }
      archive.append(JSON.stringify(r2Index, null, 2), { name: 'storage/s3-index.json' });
      archive.append(JSON.stringify({
        format: 'PonudiMi full backup', format_version: 1, created_at: new Date().toISOString(),
        database: { file: 'database/ponudimi-database.dump', format: 'PostgreSQL custom archive', bytes: dumpStat.size, pg_dump_version: toolVersions.pgDumpVersion, pg_restore_version: toolVersions.pgRestoreVersion, server_version: toolVersions.serverVersion },
        storage: { backend: s3Enabled && s3 ? 'r2' : filesystemStorage ? 'filesystem' : 'postgres', uploads: uploadStats, r2_enabled: Boolean(s3Enabled && s3), r2_object_count: r2Index.length, r2_index: 'storage/s3-index.json' },
        application: { directory: 'application/', files: applicationStats.files, bytes: applicationStats.bytes, excluded: ['.env*', '.git', 'node_modules', 'credentials', 'private keys', 'temporary files'] },
      }, null, 2), { name: 'BACKUP-MANIFEST.json' });

      await archive.finalize();
      await archiveDone;
      await captureCommand('unzip', ['-tqq', zipPath]);
      const zipStat = await fs.promises.stat(zipPath);
      if (zipStat.size < 1024) throw new Error('ZIP arhiva je neočekivano mala. Izvoz nije poslat.');

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

  app.post('/api/admin/backup/import', authenticateBackupAdmin, requireFeature('ENABLE_ADMIN_BACKUP_IMPORT', 'Uvoz baze'), importLimiter, restoreUpload.single('backup'), async (req, res, next) => {
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
      const pgEnv = pgEnvironment(process.env.DATABASE_URL);
      await pgToolVersions(pool, pgEnv);
      await captureCommand('pg_restore', ['--list', dumpPath], pgEnv);
      await new Promise((resolve, reject) => {
        const child = spawn('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-acl', '--single-transaction', '--exit-on-error', '--dbname', pgEnv.PGDATABASE, dumpPath], { env: pgEnv, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { if (stderr.length < 12000) stderr += chunk.toString(); });
        child.once('error', error => reject(error));
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
