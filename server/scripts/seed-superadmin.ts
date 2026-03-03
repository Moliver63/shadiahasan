/**
 * Script to create the first super admin user
 * Run with: tsx server/scripts/seed-superadmin.ts
 *
 * Fixed for Render PostgreSQL 17:
 * - SSL configured correctly (avoids "server closed connection unexpectedly")
 * - Connection timeout added
 * - Pool always closed via finally block
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../../drizzle/schema";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.development" });

const DEFAULT_SUPERADMIN_EMAIL = "admin@shadiahasan.club";
const DEFAULT_SUPERADMIN_PASSWORD = "Admin@123";
const DEFAULT_SUPERADMIN_NAME = "Super Administrador";

async function seedSuperAdmin() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment variables");
    process.exit(1);
  }

  console.log("🔄 Connecting to database...");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    max: 1,
  });

  pool.on("error", (err) => {
    console.error("❌ Unexpected pool error:", err.message);
  });

  const db = drizzle(pool);

  try {
    // Verify connection before doing anything
    await pool.query("SELECT 1");
    console.log("✅ Database connection established.");

    // Check if super admin already exists
    const existingSuperAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, "superadmin"))
      .limit(1);

    if (existingSuperAdmin.length > 0) {
      console.log("✅ Super admin already exists:");
      console.log(`   Email: ${existingSuperAdmin[0].email}`);
      console.log(`   Name: ${existingSuperAdmin[0].name}`);
      console.log("\n💡 If you need to reset the password, delete this user and run again.");
      return;
    }

    // Check if email is already in use
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, DEFAULT_SUPERADMIN_EMAIL))
      .limit(1);

    if (existingUser.length > 0) {
      console.log("⚠️  User exists but is not super admin — promoting...");
      await db
        .update(users)
        .set({ role: "superadmin" })
        .where(eq(users.email, DEFAULT_SUPERADMIN_EMAIL));
      console.log("✅ User promoted to super admin!");
      return;
    }

    // Create new super admin
    console.log("🔐 Hashing password...");
    const passwordHash = await bcrypt.hash(DEFAULT_SUPERADMIN_PASSWORD, 10);

    console.log("👤 Creating super admin user...");
    await db.insert(users).values({
      email: DEFAULT_SUPERADMIN_EMAIL,
      name: DEFAULT_SUPERADMIN_NAME,
      passwordHash,
      role: "superadmin",
      emailVerified: 1,
      loginMethod: "email",
    });

    console.log("\n✅ Super admin created successfully!");
    console.log("\n📋 Login credentials:");
    console.log(`   Email: ${DEFAULT_SUPERADMIN_EMAIL}`);
    console.log(`   Password: ${DEFAULT_SUPERADMIN_PASSWORD}`);
    console.log("\n⚠️  IMPORTANT: Change this password after first login!");
    console.log("\n🔗 Login at: https://shadiahasan.onrender.com/login");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await pool.end();
    console.log("🔒 Database connection closed.");
  }
}

seedSuperAdmin()
  .then(() => {
    console.log("\n✨ Seed completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  });
