import "dotenv/config";
import pg from "pg";
import fg from "fast-glob";
import fs from "fs/promises";
import path from "path";

const { Client } = pg;

function uniq(arr) {
  return [...new Set(arr)].sort();
}

// Extrai nomes de tabelas do Drizzle via regex:
// pgTable("users", ...)  /  pgTable('users', ...)
// Também pega pgTableCreator(...)("users", ...)
function extractTablesFromText(text) {
  const tables = [];

  const rePgTable = /\bpgTable\s*\(\s*["'`]([^"'`]+)["'`]\s*,/g;
  for (let m; (m = rePgTable.exec(text)); ) tables.push(m[1]);

  const reCreatorCall = /\bpgTableCreator\s*\([^)]*\)\s*\(\s*["'`]([^"'`]+)["'`]\s*,/g;
  for (let m; (m = reCreatorCall.exec(text)); ) tables.push(m[1]);

  return tables;
}

async function getDbTables(client) {
  const q = `
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
      AND table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY table_schema, table_name;
  `;
  const { rows } = await client.query(q);
  return rows;
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL não encontrado no ambiente.");
    process.exit(1);
  }

  // 1) DB tables
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const dbRows = await getDbTables(client);
  await client.end();

  const dbTablesAll = dbRows.map(r => `${r.table_schema}.${r.table_name}`);
  const dbTablesPublicOnly = dbRows
    .filter(r => r.table_schema === "public")
    .map(r => r.table_name);

  // 2) Drizzle schema files (ajuste glob se você guarda schema em outro lugar)
  const root = process.cwd();
  const patterns = [
    "drizzle/**/*.ts",
    "src/db/**/*.ts",
    "server/db/**/*.ts",
    "**/schema*.ts",
  ];

  const files = await fg(patterns, { cwd: root, absolute: true, ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"] });

  let codeTables = [];
  for (const file of files) {
    const txt = await fs.readFile(file, "utf8");
    const found = extractTablesFromText(txt);
    if (found.length) codeTables.push(...found);
  }
  codeTables = uniq(codeTables);

  // 3) Compare (considerando que o app usa public por padrão)
  const dbPublic = uniq(dbTablesPublicOnly);

  const missingInDb = codeTables.filter(t => !dbPublic.includes(t));
  const extraInDb = dbPublic.filter(t => !codeTables.includes(t));

  // 4) Report
  console.log("\n============================================================");
  console.log("  DRIZZLE SCHEMA DIFF");
  console.log("============================================================\n");

  console.log("📌 Tabelas no código (Drizzle):", codeTables.length);
  console.log("📌 Tabelas no DB (public):     ", dbPublic.length);

  console.log("\n✅ DB (todas):");
  console.log(dbTablesAll.join("\n"));

  console.log("\n❗ FALTANDO NO BANCO (existe no código, não existe no public):");
  console.log(missingInDb.length ? missingInDb.join("\n") : "(nenhuma)");

  console.log("\n⚠️ SOBRANDO NO BANCO (existe no public, não existe no código):");
  console.log(extraInDb.length ? extraInDb.join("\n") : "(nenhuma)");

  const hasDupMigrations =
    dbTablesAll.includes("public.__drizzle_migrations") &&
    dbTablesAll.includes("drizzle.__drizzle_migrations");

  console.log("\n🔎 ALERTAS:");
  if (hasDupMigrations) {
    console.log("- Você tem __drizzle_migrations duplicada em public e drizzle. Recomendo padronizar o schema de migrations.");
  } else {
    console.log("- Sem duplicidade óbvia de __drizzle_migrations.");
  }

  console.log("\n➡️ Próximo passo recomendado:");
  console.log("- Se der diferença aqui, eu te digo exatamente o SQL/migration pra corrigir.");
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});