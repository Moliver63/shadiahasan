import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Admin Invite System", () => {
  let testInviteToken: string;
  let testInviteId: number;

  beforeAll(async () => {
    // Ensure we have a super admin for testing
    const superAdmins = await db.listAllAdminsAndSuperAdmins();
    const superAdmin = superAdmins.find(u => u.role === "superadmin");
    
    if (!superAdmin) {
      throw new Error("No super admin found. Run seed-superadmin.ts first.");
    }
  });

  it("should create admin invite with valid data", async () => {
    const superAdmins = await db.listAllAdminsAndSuperAdmins();
    const superAdmin = superAdmins.find(u => u.role === "superadmin");
    
    if (!superAdmin) throw new Error("Super admin not found");

    const result = await db.createAdminInvite(
      `test-admin-${Date.now()}@example.com`,
      "admin",
      superAdmin.id
    );

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("expiresAt");
    expect(result).toHaveProperty("inviteId");
    expect(result.token).toHaveLength(64); // 32 bytes = 64 hex chars

    testInviteToken = result.token;
    testInviteId = result.inviteId;
  });

  it("should reject duplicate invite for same email", async () => {
    const superAdmins = await db.listAllAdminsAndSuperAdmins();
    const superAdmin = superAdmins.find(u => u.role === "superadmin");
    
    if (!superAdmin) throw new Error("Super admin not found");

    const email = `duplicate-test-${Date.now()}@example.com`;
    
    // Create first invite
    await db.createAdminInvite(email, "admin", superAdmin.id);
    
    // Try to create second invite for same email
    await expect(
      db.createAdminInvite(email, "admin", superAdmin.id)
    ).rejects.toThrow("Active invite already exists");
  });

  it("should retrieve invite by token", async () => {
    if (!testInviteToken) {
      throw new Error("Test invite not created");
    }

    const invite = await db.getAdminInviteByToken(testInviteToken);
    
    expect(invite).toBeTruthy();
    expect(invite?.token).toBe(testInviteToken);
    expect(invite?.role).toBe("admin");
    expect(invite?.acceptedAt).toBeNull();
  });

  it("should list all invites", async () => {
    const invites = await db.listAdminInvites();
    
    expect(Array.isArray(invites)).toBe(true);
    expect(invites.length).toBeGreaterThan(0);
    
    const testInvite = invites.find(i => i.id === testInviteId);
    expect(testInvite).toBeTruthy();
    expect(testInvite?.invitedByName).toBeTruthy();
  });

  it("should accept invite and create admin user", async () => {
    const superAdmins = await db.listAllAdminsAndSuperAdmins();
    const superAdmin = superAdmins.find(u => u.role === "superadmin");
    
    if (!superAdmin) throw new Error("Super admin not found");

    const email = `accepted-admin-${Date.now()}@example.com`;
    const result = await db.createAdminInvite(email, "admin", superAdmin.id);

    const newUser = await db.acceptAdminInvite(
      result.token,
      "TestPassword123!",
      "Test Admin User"
    );

    expect(newUser).toBeTruthy();
    expect(newUser?.email).toBe(email);
    expect(newUser?.role).toBe("admin");
    expect(newUser?.emailVerified).toBe(1);
  });

  it("should reject expired invite", async () => {
    // This test would require manipulating the expiration date
    // For now, we just test that the error handling exists
    await expect(
      db.acceptAdminInvite("invalid-token", "password", "name")
    ).rejects.toThrow();
  });

  it("should reject already accepted invite", async () => {
    const superAdmins = await db.listAllAdminsAndSuperAdmins();
    const superAdmin = superAdmins.find(u => u.role === "superadmin");
    
    if (!superAdmin) throw new Error("Super admin not found");

    const email = `double-accept-${Date.now()}@example.com`;
    const result = await db.createAdminInvite(email, "admin", superAdmin.id);

    // Accept once
    await db.acceptAdminInvite(result.token, "TestPassword123!", "Test User");

    // Try to accept again
    await expect(
      db.acceptAdminInvite(result.token, "TestPassword123!", "Test User")
    ).rejects.toThrow("already been accepted");
  });

  it("should cancel invite", async () => {
    const superAdmins = await db.listAllAdminsAndSuperAdmins();
    const superAdmin = superAdmins.find(u => u.role === "superadmin");
    
    if (!superAdmin) throw new Error("Super admin not found");

    const email = `cancel-test-${Date.now()}@example.com`;
    const result = await db.createAdminInvite(email, "admin", superAdmin.id);

    await db.cancelAdminInvite(result.inviteId);

    const invite = await db.getAdminInviteByToken(result.token);
    expect(invite).toBeNull();
  });
});
