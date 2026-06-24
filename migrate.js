const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

async function run() {
  // Manually resolve the hostname
  const addresses = await dns.promises.resolve6('db.svywangwvaelbwdztvwo.supabase.co');
  const host = addresses[0];
  console.log('Resolved DB host to:', host);

  const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema.sql'), 'utf8');

  const client = new Client({
    host,
    port: 5432,
    user: 'postgres',
    password: 'AtlasHotel_2906',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL\n');

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  console.log('Before:', tables.rows.length ? tables.rows.map(r => r.table_name).join(', ') : '(empty)');

  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  let ok = 0, fail = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt + ';');
      ok++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        ok++;
      } else {
        console.error('  FAIL:', err.message.replace(/\n/g, ' ').substring(0, 120));
        fail++;
      }
    }
  }

  const result = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  console.log('\n--- Results ---');
  console.log('Statements:', ok, 'OK,', fail, 'failed');
  console.log('Tables:', result.rows.map(r => r.table_name).join(', '));

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  console.log('\nRun the SQL manually at:');
  console.log('  https://svywangwvaelbwdztvwo.supabase.co/project/svywangwvaelbwdztvwo/sql/new');
  console.log('  Paste supabase-schema.sql into the SQL Editor and click Run.');
  process.exit(1);
});
