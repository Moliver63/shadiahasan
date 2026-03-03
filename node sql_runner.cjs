import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Conectado!');

  const users = await client.query('SELECT id, email, role, plan FROM users ORDER BY id');
  console.log('\n=== USUARIOS ===');
  console.table(users.rows);

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('\n=== TABELAS ===');
  console.table(tables.rows);

  await client.end();
}

main().catch(e => { console.error('Erro:', e.message); client.end(); });