import pg from 'pg';

const email = String(process.argv[2] || '').trim().toLowerCase();
const configuredAdmin = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nije podešen.');
if (!configuredAdmin) throw new Error('ADMIN_EMAIL nije podešen.');
if (!email || email !== configuredAdmin) {
  console.error('Dozvoljeno je dodeliti administratorsku ulogu samo adresi podešenoj u ADMIN_EMAIL.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 8000,
});

try {
  const user = await pool.query('SELECT id,email FROM users WHERE lower(email)=$1', [email]);
  if (!user.rows[0]) {
    console.error('Nalog ne postoji. Prvo napravi nalog kroz stranicu Registracija, pa ponovi ovu komandu.');
    process.exitCode = 1;
  } else {
    await pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
      [user.rows[0].id],
    );
    console.log(`Administratorska uloga dodeljena nalogu ${user.rows[0].email}.`);
  }
} finally {
  await pool.end();
}
