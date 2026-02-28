/**
 * Script to create the first super admin user
 * Run with: tsx server/scripts/seed-superadmin.ts
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../../drizzle/schema";
import * as bcrypt from "bcrypt";

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
  const db = drizzle(DATABASE_URL);

  try {
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
      console.log("\n💡 If you need to reset the password, delete this user from the database and run this script again.");
      return;
    }

    // Check if email is already in use
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, DEFAULT_SUPERADMIN_EMAIL))
      .limit(1);

    if (existingUser.length > 0) {
      console.log("⚠️  User with this email already exists but is not a super admin");
      console.log("   Promoting to super admin...");
      
      await db
        .update(users)
        .set({ role: "superadmin" })
        .where(eq(users.email, DEFAULT_SUPERADMIN_EMAIL));
      
      console.log("✅ User promoted to super admin successfully!");
      console.log(`   Email: ${DEFAULT_SUPERADMIN_EMAIL}`);
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
    console.log("\n🔗 Login at: https://shadiahasan.club/login");
    
  } catch (error) {
    console.error("❌ Error creating super admin:", error);
    process.exit(1);
  }
}

// Run the seed function
seedSuperAdmin()
  .then(() => {
    console.log("\n✨ Seed completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  });
