import pg from "pg";
import dotenv from "dotenv";

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
  console.log("Conectado!");

  // 1) Se existir um ENUM chamado "interval" criado por engano E o usuário atual
  //    for o dono, renomeia para billing_interval.
  //    Caso não seja dono, captura a exceção e pula silenciosamente.
  //    (O passo 2 garante que billing_interval exista de qualquer forma)
  await client.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'interval'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_roles r ON r.oid = t.typowner
      WHERE t.typname = 'interval'
        AND r.rolname = current_user
    ) THEN
      BEGIN
        ALTER TYPE "interval" RENAME TO billing_interval;
        RAISE NOTICE 'Tipo "interval" renomeado para billing_interval com sucesso.';
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'Sem permissão para renomear o tipo "interval". Pulando...';
        WHEN others THEN
          RAISE NOTICE 'Erro ao renomear tipo "interval": %. Pulando...', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'Tipo "interval" existe mas pertence a outro usuário. Pulando rename...';
    END IF;
  END IF;
END $$;
  `);

  // 2) Se billing_interval não existir, cria
  await client.query(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_interval') THEN
    CREATE TYPE billing_interval AS ENUM ('month', 'year');
    RAISE NOTICE 'Tipo billing_interval criado com sucesso.';
  ELSE
    RAISE NOTICE 'Tipo billing_interval já existe.';
  END IF;
END $$;
  `);

  // 3) Garantir que a coluna subscription_plans.interval exista e esteja com tipo correto
  //    - se não existir: cria
  //    - se existir com tipo errado (inclusive udt_name = 'interval' do ENUM antigo): recria
  const col = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'interval';
  `);

  if (col.rows.length === 0) {
    await client.query(`
      ALTER TABLE subscription_plans
      ADD COLUMN "interval" billing_interval NOT NULL DEFAULT 'month';
    `);
    console.log('OK: coluna "interval" criada como billing_interval.');
  } else if (col.rows[0].udt_name !== "billing_interval") {
    console.log(
      `Info: coluna "interval" tem tipo "${col.rows[0].udt_name}". Recriando como billing_interval...`
    );
    await client.query(`
      ALTER TABLE subscription_plans DROP COLUMN IF EXISTS "interval";
    `);
    await client.query(`
      ALTER TABLE subscription_plans
      ADD COLUMN "interval" billing_interval NOT NULL DEFAULT 'month';
    `);
    console.log('OK: coluna "interval" recriada como billing_interval.');
  } else {
    console.log('Info: coluna "interval" já está correta (billing_interval).');
  }

  // 4) Inserir planos (seed). Requer UNIQUE(slug) na tabela.
  await client.query(`
    INSERT INTO subscription_plans
      (name, slug, description, price, "interval", "isActive", "hasVRAccess", "hasLiveSupport", "createdAt", "updatedAt")
    VALUES
      ('Gratuito', 'free',    'Acesso básico',    0,    'month', 1, 0, 0, NOW(), NOW()),
      ('Básico',   'basic',   'Cursos essenciais', 2990, 'month', 1, 0, 0, NOW(), NOW()),
      ('Premium',  'premium', 'Acesso completo',   5990, 'month', 1, 1, 0, NOW(), NOW()),
      ('VIP',      'vip',     'Acesso total',       9990, 'month', 1, 1, 1, NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING;
  `);
  console.log("Planos inseridos (ou já existiam)!");

  // 5) Mostrar diagnóstico final
  const cols = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    ORDER BY column_name;
  `);
  console.log("\n=== COLUNAS subscription_plans ===");
  console.table(cols.rows);

  const plans = await client.query(
    `SELECT id, name, slug, price, "interval" FROM subscription_plans ORDER BY id;`
  );
  console.log("\n=== PLANOS ===");
  console.table(plans.rows);

  await client.end();
}

main().catch(async (e) => {
  console.error("Erro:", e.message);
  try {
    await client.end();
  } catch {}
});
