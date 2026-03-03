import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL não definido");
  process.exit(1);
}

const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
const ssl = isLocal ? undefined : { rejectUnauthorized: true };

const client = new Client({ connectionString: url, ssl });

try {
  await client.connect();
  console.log("✅ Conectado no Postgres");

  const schemas = await client.query(`
    select schema_name
    from information_schema.schemata
    where schema_name in ('public','drizzle')
    order by schema_name;
  `);

  console.log("\n📌 Schemas:");
  console.table(schemas.rows);

  const tables = await client.query(`
    select table_schema, table_name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name;
  `);

  console.log("\n📌 Tabelas (não-sistema):");
  console.table(tables.rows);
} catch (err) {
  console.error("❌ Falha ao conectar/consultar:", err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
