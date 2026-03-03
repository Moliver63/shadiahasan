import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definido");

const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
const ssl = isLocal ? undefined : { rejectUnauthorized: true };

// max: 1 deixa mais estável para migrations em ambientes remotos
const pool = new pg.Pool({
  connectionString: url,
  ssl,
  max: 1,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 15000,
});

const db = drizzle(pool);

try {
  console.log("▶ Rodando migrations (script)...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations aplicadas com sucesso");
} finally {
  await pool.end().catch(() => {});
}
