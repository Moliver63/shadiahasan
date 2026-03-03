/**
 * Script de verificação do banco de dados Render
 * Testa conexão e exibe o estado atual das tabelas principais
 *
 * Como usar:
 *   1. Coloque este arquivo na raiz do projeto
 *   2. Execute: npx tsx check-db.ts
 *      OU com a DATABASE_URL diretamente:
 *      DATABASE_URL="postgresql://..." npx tsx check-db.ts
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.development" });

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://shadia_db_user:P5sBxrA7nocmuTmnAVcY8soeIx9RtrT7@dpg-d6hnq9hdrdic73cp01bg-a.oregon-postgres.render.com/shadia_db?sslmode=require";

async function checkDatabase() {
  console.log("===========================================");
  console.log("  VERIFICAÇÃO DO BANCO DE DADOS - RENDER  ");
  console.log("===========================================\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 1,
  });

  pool.on("error", (err) => {
    console.error("❌ Erro inesperado no pool:", err.message);
  });

  try {
    // 1. Teste básico de conexão
    console.log("🔄 Testando conexão...");
    const pingResult = await pool.query("SELECT NOW() as now, version() as version");
    console.log("✅ Conexão OK!");
    console.log(`   Hora do servidor : ${pingResult.rows[0].now}`);
    console.log(`   Versão PostgreSQL: ${pingResult.rows[0].version.split(" ").slice(0, 2).join(" ")}`);
    console.log("");

    // 2. Listar todas as tabelas existentes
    console.log("📋 Tabelas encontradas no banco:");
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log("   ⚠️  Nenhuma tabela encontrada! Migrations não foram rodadas.");
    } else {
      tablesResult.rows.forEach((row) => {
        console.log(`   - ${row.table_name}`);
      });
    }
    console.log("");

    // 3. Contagem por tabela principal
    const mainTables = [
      "users",
      "courses",
      "lessons",
      "enrollments",
      "plans",
      "subscriptions",
      "ebooks",
    ];

    console.log("📊 Contagem de registros:");
    for (const table of mainTables) {
      const exists = tablesResult.rows.find((r) => r.table_name === table);
      if (!exists) {
        console.log(`   ${table.padEnd(15)}: ⚠️  tabela não existe`);
        continue;
      }
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM "${table}"`);
        const total = parseInt(countResult.rows[0].total);
        const icon = total > 0 ? "✅" : "⬜";
        console.log(`   ${table.padEnd(15)}: ${icon} ${total} registro(s)`);
      } catch (err: any) {
        console.log(`   ${table.padEnd(15)}: ❌ erro ao consultar (${err.message})`);
      }
    }
    console.log("");

    // 4. Verificar superadmin especificamente
    const usersExists = tablesResult.rows.find((r) => r.table_name === "users");
    if (usersExists) {
      console.log("👤 Verificando usuários admin:");
      const adminsResult = await pool.query(`
        SELECT id, name, email, role, "emailVerified", "createdAt"
        FROM users
        WHERE role IN ('admin', 'superadmin')
        ORDER BY "createdAt" DESC;
      `);

      if (adminsResult.rows.length === 0) {
        console.log("   ⚠️  Nenhum admin encontrado. Rode o seed-superadmin.ts!");
      } else {
        adminsResult.rows.forEach((u) => {
          const verified = u.emailVerified ? "✅ verificado" : "❌ não verificado";
          console.log(`   [${u.role.toUpperCase()}] ${u.name} <${u.email}> — ${verified}`);
        });
      }
      console.log("");

      // 5. Total geral de usuários
      const totalUsers = await pool.query(`SELECT COUNT(*) as total FROM users`);
      console.log(`👥 Total de usuários cadastrados: ${totalUsers.rows[0].total}`);
      console.log("");
    }

    console.log("===========================================");
    console.log("  VERIFICAÇÃO CONCLUÍDA                   ");
    console.log("===========================================");

  } catch (error: any) {
    console.error("\n❌ Falha na verificação:");
    console.error(`   ${error.message}`);

    if (error.message.includes("SSL")) {
      console.error("\n💡 Dica: Problema de SSL. Verifique se sslmode=require está na DATABASE_URL.");
    } else if (error.message.includes("connect")) {
      console.error("\n💡 Dica: Não foi possível conectar. Verifique se o banco está ativo no Render.");
    } else if (error.message.includes("password")) {
      console.error("\n💡 Dica: Credenciais incorretas. Confira a DATABASE_URL.");
    }

    throw error;
  } finally {
    await pool.end();
    console.log("\n🔒 Conexão encerrada.");
  }
}

checkDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
