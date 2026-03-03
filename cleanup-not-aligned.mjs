import "dotenv/config";
import pg from "pg";
import fg from "fast-glob";
import fs from "fs/promises";

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

async function getSchemaTableCount(client, schemaName) {
  const q = `
    SELECT count(*)::int AS cnt
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
      AND table_schema = $1;
  `;
  const { rows } = await client.query(q, [schemaName]);
  return rows[0]?.cnt ?? 0;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes("--apply"),
    yes: argv.includes("--yes"),
    allowDropDrizzleSchema: argv.includes("--drop-drizzle-schema"),
  };
}

async function main() {
  const { apply, yes, allowDropDrizzleSchema } = parseArgs();

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL não encontrado no ambiente.");
    process.exit(1);
  }

  // 1) Ler tabelas do banco
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const dbRows = await getDbTables(client);

  const dbPublicTables = uniq(
    dbRows.filter(r => r.table_schema === "public").map(r => r.table_name)
  );

  const dbDrizzleTables = uniq(
    dbRows.filter(r => r.table_schema === "drizzle").map(r => r.table_name)
  );

  // 2) Ler tabelas declaradas no Drizzle (código)
  const patterns = [
    "drizzle/**/*.ts",
    "src/db/**/*.ts",
    "server/db/**/*.ts",
    "**/schema*.ts",
  ];

  const files = await fg(patterns, {
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  });

  let codeTables = [];
  for (const file of files) {
    const txt = await fs.readFile(file, "utf8");
    const found = extractTablesFromText(txt);
    if (found.length) codeTables.push(...found);
  }
  codeTables = uniq(codeTables);

  // 3) Determinar o que está “sobrando” no public (em geral: nada, exceto __drizzle_migrations)
  const extraInPublic = dbPublicTables.filter(t => !codeTables.includes(t));

  // 4) Política “alinhada com o projeto”
  // - manter tudo do app no public
  // - manter SOMENTE public.__drizzle_migrations
  // - remover drizzle.__drizzle_migrations se existir
  // - (opcional) remover schema drizzle se ficar vazio
  const actions = [];

  const hasPublicMigrations = dbPublicTables.includes("__drizzle_migrations");
  const hasDrizzleMigrations = dbDrizzleTables.includes("__drizzle_migrations");

  if (hasPublicMigrations && hasDrizzleMigrations) {
    actions.push({
      kind: "drop_table",
      schema: "drizzle",
      table: "__drizzle_migrations",
      sql: `DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations";`,
      reason: "Duplicidade: manter migrations no public (alinhado ao projeto).",
    });
  }

  // Se apareceu extra no public, listar mas NÃO remover automaticamente,
  // porque pode ter tabelas criadas manualmente (logs antigos, extensões, etc.).
  // Você pode forçar depois, mas por padrão vamos só reportar.
  const safeExtraPublic = extraInPublic.filter(t => t === "__drizzle_migrations");
  const otherExtraPublic = extraInPublic.filter(t => t !== "__drizzle_migrations");

  // Se por algum motivo você quiser remover __drizzle_migrations do public (normalmente NÃO),
  // não faremos isso automaticamente.
  if (safeExtraPublic.includes("__drizzle_migrations") && !codeTables.includes("__drizzle_migrations")) {
    // Isto vai acontecer sempre, pois o schema do código não declara migrations table.
    // Então apenas informamos, não removemos.
  }

  // 5) Preview
  console.log("\n============================================================");
  console.log("  CLEANUP (NOT ALIGNED) - PREVIEW");
  console.log("============================================================\n");

  console.log("📌 Tabelas no código (Drizzle):", codeTables.length);
  console.log("📌 Tabelas no DB (public):     ", dbPublicTables.length);
  console.log("📌 Tabelas no DB (drizzle):    ", dbDrizzleTables.length);

  console.log("\n🔎 Extra no public (DB - código):");
  console.log(extraInPublic.length ? extraInPublic.join("\n") : "(nenhuma)");

  if (otherExtraPublic.length) {
    console.log("\n⚠️ Aviso: existem tabelas extras no public além de __drizzle_migrations.");
    console.log("➡️ Por segurança, este script NÃO remove automaticamente essas tabelas:");
    console.log(otherExtraPublic.join("\n"));
  }

  console.log("\n🧹 Ações propostas (seguras):");
  if (!actions.length) {
    console.log("(nenhuma ação necessária)");
  } else {
    for (const a of actions) {
      console.log(`- ${a.kind}: ${a.schema}.${a.table}`);
      console.log(`  motivo: ${a.reason}`);
      console.log(`  SQL: ${a.sql}`);
    }
  }

  // 6) Aplicar
  if (!apply) {
    console.log("\n✅ DRY RUN concluído. Para aplicar de verdade, rode:");
    console.log("   node cleanup-not-aligned.mjs --apply");
    console.log("\nOpcional: para tentar dropar o schema drizzle (se vazio depois), use:");
    console.log("   node cleanup-not-aligned.mjs --apply --drop-drizzle-schema");
    await client.end();
    return;
  }

  if (!yes) {
    console.log("\n❌ Segurança: para aplicar sem prompts, rode com --yes");
    console.log("   node cleanup-not-aligned.mjs --apply --yes");
    await client.end();
    process.exit(1);
  }

  console.log("\n🚨 APLICANDO...");
  try {
    await client.query("BEGIN");

    for (const a of actions) {
      await client.query(a.sql);
    }

    if (allowDropDrizzleSchema) {
      // Se sobrar só o schema vazio, podemos remover.
      const cnt = await getSchemaTableCount(client, "drizzle");
      if (cnt === 0) {
        await client.query(`DROP SCHEMA IF EXISTS "drizzle";`);
        console.log('✅ Schema "drizzle" removido (estava vazio).');
      } else {
        console.log(`ℹ️ Schema "drizzle" não foi removido: ainda tem ${cnt} tabela(s).`);
      }
    }

    await client.query("COMMIT");
    console.log("✅ Cleanup aplicado com sucesso.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao aplicar cleanup. Rollback executado.\n", e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ Erro fatal:", e);
  process.exit(1);
});