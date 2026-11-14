import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import archiver from 'archiver';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const excludedDirectories = new Set([
  '.git', 'node_modules', 'dist', 'coverage', '.cache', '.turbo', '.next',
  '.vercel', 'backups', 'backup', 'tmp', 'temp', 'playwright-report', 'test-results',
  'secrets', '.ssh',
]);

function isExcludedPath(relativePath, absolutePath, uploadRoot) {
  const parts = relativePath.split('/');
  const lowerName = parts[parts.length - 1].toLowerCase();
  if (parts.some(part => excludedDirectories.has(part) || part.startsWith('.env'))) return true;
  if (['.npmrc', '.pypirc', 'credentials.json', 'service-account.json', 'id_rsa', 'id_ed25519'].includes(lowerName)) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(lowerName)) return true;
  if (uploadRoot && (absolutePath === uploadRoot || absolutePath.startsWith(uploadRoot + path.sep))) return true;
  return false;
}

async function* walkFiles(root, uploadRoot = null) {
  const absoluteRoot = path.resolve(root);
  let rootStat;
  try {
    rootStat = await fs.promises.stat(absoluteRoot);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (!rootStat.isDirectory()) return;

  const pending = [absoluteRoot];
  while (pending.length) {
    const directory = pending.pop();
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(absoluteRoot, absolutePath).split(path.sep).join('/');
      if (isExcludedPath(relativePath, absolutePath, uploadRoot)) continue;
      if (entry.isDirectory()) pending.push(absolutePath);
      else if (entry.isFile()) yield { absolutePath, relativePath };
    }
  }
}

async function appendDirectory(archive, root, archivePrefix, uploadRoot = null) {
  let files = 0;
  let bytes = 0;
  for await (const file of walkFiles(root, uploadRoot)) {
    const stat = await fs.promises.stat(file.absolutePath);
    archive.file(file.absolutePath, { name: archivePrefix + '/' + file.relativePath });
    files += 1;
    bytes += stat.size;
  }
  return { files, bytes };
}

function pgEnvironment(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL nije PostgreSQL URL.');
  }
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
    child.stdout.on('data', chunk => {
      if (stdout.length < 12000) stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      if (stderr.length < 12000) stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(stderr.trim() || command + ' nije uspeo (kod ' + code + ').'));
    });
  });
}

async function createSqlDump(pool, targetPath) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nije podešen.');
  const versionResult = await captureCommand('pg_dump', ['--version']);
  const versionMatch = versionResult.stdout.match(/(\d+)(?:\.\d+)?/);
  if (!versionMatch) throw new Error('Nije moguće utvrditi verziju pg_dump alata.');
  const clientMajor = Number(versionMatch[1]);

  const serverResult = await pool.query("SELECT current_setting('server_version_num')::int AS version_num, current_setting('server_version') AS version");
  const serverVersionNum = Number(serverResult.rows[0]?.version_num);
  const serverMajor = Math.floor(serverVersionNum / 10000);
  if (!serverMajor) throw new Error('Nije moguće utvrditi verziju PostgreSQL servera.');
  if (clientMajor < serverMajor) {
    throw new Error('pg_dump verzija ' + clientMajor + ' je starija od PostgreSQL servera verzije ' + serverMajor + '. Izvoz je zaustavljen radi zaštite podataka.');
  }

  const child = spawn('pg_dump', [
    '--no-owner',
    '--no-acl',
    '--format=plain',
    '--encoding=UTF8',
  ], {
    env: pgEnvironment(process.env.DATABASE_URL),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', chunk => {
    if (stderr.length < 12000) stderr += chunk.toString();
  });
  const output = fs.createWriteStream(targetPath, { flags: 'wx', mode: 0o600 });
  const streamTask = pipeline(child.stdout, output);
  const exitTask = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || 'pg_dump nije uspeo (kod ' + code + ').'));
    });
  });
  try {
    await Promise.all([streamTask, exitTask]);
  } catch (error) {
    child.kill('SIGTERM');
    await Promise.allSettled([streamTask, exitTask]);
    throw error;
  }
  const stat = await fs.promises.stat(targetPath);
  if (!stat.size) throw new Error('pg_dump je napravio prazan SQL fajl.');
  return {
    path: targetPath,
    bytes: stat.size,
    clientVersion: versionResult.stdout,
    serverVersion: serverResult.rows[0].version,
  };
}

function waitForArchiveEntry(archive, expectedName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      archive.off('entry', onEntry);
      archive.off('error', onError);
    };
    const onEntry = entry => {
      if (entry.name === expectedName) {
        cleanup();
        resolve();
      }
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    archive.on('entry', onEntry);
    archive.once('error', onError);
  });
}

async function appendR2Objects(archive, s3, bucket) {
  const index = [];
  let continuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
    }));
    for (const item of page.Contents || []) {
      if (!item.Key) continue;
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: item.Key }));
      if (!object.Body) throw new Error('R2 objekat nema sadržaj: ' + item.Key);
      const archivePath = 'r2/objects/' + createHash('sha256').update(item.Key).digest('hex');
      const entryDone = waitForArchiveEntry(archive, archivePath);
      archive.append(object.Body, { name: archivePath });
      await entryDone;
      index.push({
        original_key: item.Key,
        archive_path: archivePath,
        size: item.Size ?? null,
        etag: item.ETag ?? null,
        last_modified: item.LastModified ? item.LastModified.toISOString() : null,
        content_type: object.ContentType || 'application/octet-stream',
      });
    }
    if (page.IsTruncated && !page.NextContinuationToken) {
      throw new Error('R2 lista objekata nije kompletna; nedostaje continuation token.');
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return index;
}

const restoreInstructions = [
  'PONUDIMI — UPUTSTVO ZA VRAĆANJE REZERVNE KOPIJE',
  '',
  '1. Napravi novu, praznu PostgreSQL bazu kompatibilne verzije.',
  '2. Učitaj SQL dump: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/ponudimi.sql',
  '3. Instaliraj aplikaciju iz direktorijuma application/ i ručno podesi potrebne promenljive okruženja. Tajne i .env fajlovi nisu deo arhive.',
  '4. Ako manifest navodi lokalne upload fajlove, kopiraj sadržaj uploads/ u UPLOAD_DIR, uz očuvanje strukture direktorijuma.',
  '5. Ako postoji r2-index.json, vrati svaki fajl iz archive_path u R2 bucket pod original_key. Postavi sačuvani content_type.',
  '6. Pokreni aplikaciju u test okruženju i proveri prijavu, oglase, fotografije i poslovne kataloge pre promene javnog domena.',
  '',
  'Ova arhiva sadrži lične podatke i heširane lozinke. Čuvaj je privatno.',
].join('\n');

export function registerBackupExport({ app, pool, auth, admin, s3, s3Bucket, uploadDir, repoRoot, storageBackend }) {
  const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 2,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: req => req.user?.sub ? 'user:' + req.user.sub : ipKeyGenerator(req.ip),
    message: { error: 'Dostignuto je ograničenje od dva izvoza u jednom satu.' },
  });

  app.get('/api/admin/backup/export', auth, admin, exportLimiter, async (req, res) => {
    if (process.env.ENABLE_ADMIN_BACKUP_EXPORT !== 'true') {
      return res.status(503).json({ error: 'Izvoz baze je trenutno isključen.' });
    }

    let temporaryDirectory;
    const cleanup = async () => {
      if (temporaryDirectory) {
        await fs.promises.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
        temporaryDirectory = null;
      }
    };

    try {
      temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ponudimi-backup-'));
      const sqlPath = path.join(temporaryDirectory, 'ponudimi.sql');
      const zipPath = path.join(temporaryDirectory, 'ponudimi-backup.zip');
      const dump = await createSqlDump(pool, sqlPath);

      const archive = archiver('zip', { zlib: { level: 6 } });
      const output = fs.createWriteStream(zipPath, { flags: 'wx', mode: 0o600 });
      const archiveDone = new Promise((resolve, reject) => {
        output.once('close', resolve);
        output.once('error', reject);
        archive.once('error', reject);
        archive.once('warning', reject);
      });
      archive.pipe(output);
      archive.file(sqlPath, { name: 'database/ponudimi.sql' });

      const uploadStats = await appendDirectory(archive, uploadDir, 'uploads');
      const applicationStats = await appendDirectory(archive, repoRoot, 'application', uploadDir);
      if (!applicationStats.files) throw new Error('Izvorni kod aplikacije nije pronađen; ZIP nije napravljen.');

      const r2Index = s3 && s3Bucket ? await appendR2Objects(archive, s3, s3Bucket) : [];
      archive.append(JSON.stringify({
        format: 'PonudiMi full backup',
        format_version: 1,
        created_at: new Date().toISOString(),
        database: {
          file: 'database/ponudimi.sql',
          format: 'plain SQL',
          bytes: dump.bytes,
          pg_dump_version: dump.clientVersion,
          server_version: dump.serverVersion,
        },
        storage: {
          backend: storageBackend || 'unknown',
          uploads: uploadStats,
          r2_enabled: Boolean(s3 && s3Bucket),
          r2_object_count: r2Index.length,
          r2_index: 'r2-index.json',
        },
        application: {
          directory: 'application/',
          files: applicationStats.files,
          bytes: applicationStats.bytes,
          excluded: ['.env*', .git, node_modules, credentials, private keys, temporary files],
        },
      }, null, 2), { name: 'BACKUP-MANIFEST.json' });
      archive.append(JSON.stringify(r2Index, null, 2), { name: 'r2-index.json' });
      archive.append(restoreInstructions, { name: 'RESTORE-INSTRUCTIONS.txt' });

      await archive.finalize();
      await archiveDone;
      await captureCommand('unzip', ['-tqq', zipPath]);
      const zipStat = await fs.promises.stat(zipPath);
      if (!zipStat.size) throw new Error('ZIP arhiva je prazna.');

      const filename = 'ponudimi-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.zip';
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.download(zipPath, filename, async error => {
        if (error) console.error('[BACKUP_EXPORT_DOWNLOAD_FAILED]', error);
        await cleanup();
      });
    } catch (error) {
      console.error('[BACKUP_EXPORT_FAILED]', error);
      await cleanup();
      if (!res.headersSent) {
        const missingTool = error.code === 'ENOENT' && /pg_dump|unzip/.test(String(error.path || error.message));
        const message = missingTool
          ? 'Na API serveru nedostaje potreban alat pg_dump ili unzip.'
          : 'Izvoz nije uspeo. ZIP nije isporučen, a postojeća baza nije menjana.';
        res.status(503).json({ error: message });
      } else {
        res.destroy(error);
      }
    }
  });
}
