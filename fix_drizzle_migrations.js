import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definido no ambiente.");
  }

  await client.connect();
  console.log("Conectado!\n");

  // 1) Garante que a tabela de controle do Drizzle existe
  await client.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  // 2) Lê o journal do Drizzle
  const journalPath = path.resolve("drizzle", "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    throw new Error(
      `Journal não encontrado em: ${journalPath}\n` +
      `Verifique se a pasta de migrations está em "drizzle/".`
    );
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const entries = journal.entries;

  console.log(`📂 ${entries.length} migration(s) encontrada(s) no journal:\n`);

  // 3) Busca as migrations já registradas no banco
  const { rows: applied } = await client.query(
    `SELECT hash FROM "__drizzle_migrations";`
  );
  const appliedHashes = new Set(applied.map((r) => r.hash));

  // 4) Para cada migration do journal, insere se necessário
  let inserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    const tag = entry.tag;
    const when = entry.when;

    if (appliedHashes.has(tag)) {
      console.log(`  ✅ [JÁ APLICADA]  ${tag}`);
      skipped++;
      continue;
    }

    const sqlFile = path.resolve("drizzle", `${tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      console.warn(`  ⚠️  [ARQUIVO NÃO ENCONTRADO] ${tag}.sql — pulando`);
      skipped++;
      continue;
    }

    await client.query(
      `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
      [tag, when]
    );

    console.log(`  🔧 [MARCADA COMO APLICADA] ${tag}`);
    inserted++;
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   Já aplicadas (ignoradas): ${skipped}`);
  console.log(`   Marcadas agora:           ${inserted}`);
  console.log(`   Total no journal:         ${entries.length}`);

  const { rows: final } = await client.query(
    `SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at;`
  );
  console.log("\n=== ESTADO FINAL __drizzle_migrations ===");
  console.table(final);

  await client.end();
  console.log("\n✅ Concluído! Agora rode: npx drizzle-kit migrate");
}

main().catch(async (e) => {
  console.error("\n❌ Erro:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
