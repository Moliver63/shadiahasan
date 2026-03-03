import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const EXPECTED_FOREIGN_KEYS = [
  ["user_profiles", "userId", "users", "id"],
  ["user_subscriptions", "userId", "users", "id"],
  ["subscriptions", "userId", "users", "id"],
  ["enrollments", "userId", "users", "id"],
  ["enrollments", "courseId", "courses", "id"],
  ["lessons", "courseId", "courses", "id"],
  ["course_modules", "courseId", "courses", "id"],
  ["course_reviews", "userId", "users", "id"],
  ["course_reviews", "courseId", "courses", "id"],
  ["messages", "conversationId", "conversations", "id"],
  ["messages", "senderId", "users", "id"],
  ["notifications", "userId", "users", "id"],
  ["payment_history", "userId", "users", "id"],
  ["appointments", "userId", "users", "id"],
];

const EXPECTED_UNIQUES = [
  ["users", "email"],
  ["users", "googleId"],
  ["enrollments", "userId,courseId"],
  ["refresh_tokens", "token"],
];

const EXPECTED_INDEXES = [
  ["users", "email"],
  ["messages", "conversationId"],
  ["messages", "createdAt"],
  ["notifications", "userId"],
  ["enrollments", "userId"],
  ["enrollments", "courseId"],
  ["subscriptions", "userId"],
];

async function getForeignKeys(client) {
  const q = `
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema='public';
  `;
  return (await client.query(q)).rows;
}

async function getUniques(client) {
  const q = `
  SELECT tablename, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexdef ILIKE '%UNIQUE%';
  `;
  return (await client.query(q)).rows;
}

async function getIndexes(client) {
  const q = `
  SELECT tablename, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public';
  `;
  return (await client.query(q)).rows;
}

function checkFKs(dbFKs) {
  const missing = [];
  for (const fk of EXPECTED_FOREIGN_KEYS) {
    const exists = dbFKs.find(
      r =>
        r.table_name === fk[0] &&
        r.column_name === fk[1] &&
        r.foreign_table === fk[2]
    );
    if (!exists) missing.push(fk);
  }
  return missing;
}

function checkUniques(dbUniques) {
  const missing = [];
  for (const [table, col] of EXPECTED_UNIQUES) {
    const exists = dbUniques.find(
      r => r.tablename === table && r.indexdef.includes(col)
    );
    if (!exists) missing.push([table, col]);
  }
  return missing;
}

function checkIndexes(dbIndexes) {
  const missing = [];
  for (const [table, col] of EXPECTED_INDEXES) {
    const exists = dbIndexes.find(
      r => r.tablename === table && r.indexdef.includes(col)
    );
    if (!exists) missing.push([table, col]);
  }
  return missing;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const fks = await getForeignKeys(client);
  const uniques = await getUniques(client);
  const indexes = await getIndexes(client);

  console.log("\n🔗 FKs faltando:");
  console.table(checkFKs(fks));

  console.log("\n🔒 UNIQUE faltando:");
  console.table(checkUniques(uniques));

  console.log("\n⚡ INDEX faltando:");
  console.table(checkIndexes(indexes));

  await client.end();
}

main();