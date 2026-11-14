import pg from 'pg';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backupPath = process.argv[2];
const confirmFlag = '--i-understand-target-db-will-be-cleared';

if (!backupPath || !process.argv.includes(confirmFlag)) {
  console.error('Upotreba: DATABASE_URL=... node standalone/scripts/restore-json-backup.mjs <backup.json.gz> ' + confirmFlag);
  console.error('UPOZORENJE: ciljna baza mora biti nova ili namenjena isključivo za vraćanje ove kopije.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('Nedostaje DATABASE_URL.');
  process.exit(2);
}

const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
const raw = await fs.readFile(path.resolve(backupPath));
const backup = JSON.parse(gunzipSync(raw).toString('utf8'));
if (backup?.format !== 'ponudimi-postgres-json-v1' || !Array.isArray(backup.tables)) {
  throw new Error('Nepoznat ili neispravan format rezervne kopije.');
}
const seen = new Set();
for (const table of backup.tables) {
  if (!table || typeof table.name !== 'string' || !Array.isArray(table.rows) || seen.has(table.name)) {
    throw new Error('Arhiva sadrži neispravnu ili ponovljenu tabelu.');
  }
  seen.add(table.name);
  if (Number(table.row_count) !== table.rows.length) {
    throw new Error('Broj redova nije potpun za tabelu ' + table.name + '.');
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined, max: 1 });
const client = await pool.connect();
try {
  const database = await client.query('SELECT current_database() AS name');
  console.log('Ciljna baza:', database.rows[0].name);

  const initSql = await fs.readFile(path.resolve(here, '../db/init.sql'), 'utf8');
  await client.query(initSql);

  const catalogSource = await fs.readFile(path.resolve(here, '../api/business-catalog.mjs'), 'utf8');
  const catalogSchema = catalogSource.match(/const schema = \x60([\s\S]*?)\x60;/);
  if (!catalogSchema) throw new Error('Ne mogu da pronađem šemu poslovnog kataloga.');
  await client.query(catalogSchema[1]);

  const targetTablesResult = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  const targetTables = new Set(targetTablesResult.rows.map(row => row.table_name));
  for (const table of backup.tables) {
    if (!targetTables.has(table.name)) throw new Error('U ciljnoj bazi nedostaje tabela ' + table.name + '.');
  }

  const allTables = [...targetTables];
  if (allTables.length) {
    await client.query('TRUNCATE TABLE ' + allTables.map(name => 'public.' + quote(name)).join(', ') + ' RESTART IDENTITY CASCADE');
  }

  const dependencyResult = await client.query(
    "SELECT child.relname AS child, parent.relname AS parent " +
    "FROM pg_constraint c " +
    "JOIN pg_class child ON child.oid=c.conrelid " +
    "JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace " +
    "JOIN pg_class parent ON parent.oid=c.confrelid " +
    "JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace " +
    "WHERE c.contype='f' AND child_ns.nspname='public' AND parent_ns.nspname='public'"
  );
  const names = backup.tables.map(table => table.name);
  const nameSet = new Set(names);
  const children = new Map(names.map(name => [name, new Set()]));
  const indegree = new Map(names.map(name => [name, 0]));
  for (const edge of dependencyResult.rows) {
    if (!nameSet.has(edge.child) || !nameSet.has(edge.parent) || edge.child === edge.parent) continue;
    if (!children.get(edge.parent).has(edge.child)) {
      children.get(edge.parent).add(edge.child);
      indegree.set(edge.child, indegree.get(edge.child) + 1);
    }
  }
  const ready = names.filter(name => indegree.get(name) === 0);
  const ordered = [];
  while (ready.length) {
    const name = ready.shift();
    ordered.push(name);
    for (const child of children.get(name)) {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) ready.push(child);
    }
  }
  if (ordered.length !== names.length) {
    throw new Error('Pronađena je kružna veza između tabela. Vraćanje je zaustavljeno bez upisa podataka.');
  }

  await client.query('BEGIN');
  try {
    for (const name of ordered) {
      const table = backup.tables.find(item => item.name === name);
      const target = 'public.' + quote(name);
      for (let offset = 0; offset < table.rows.length; offset += 50) {
        const batch = table.rows.slice(offset, offset + 50);
        await client.query(
          'INSERT INTO ' + target + ' SELECT * FROM jsonb_populate_recordset(NULL::' + target + ', $1::jsonb)',
          [JSON.stringify(batch)]
        );
      }
      console.log(name + ': ' + table.rows.length + ' redova');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  console.log('Vraćanje rezervne kopije je završeno.');
  console.log('Izvorna baza:', backup.database, '| Datum kopije:', backup.created_at);
} finally {
  client.release();
  await pool.end();
}
