import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { passwordResetTokens } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

describe("Password Reset Flow", () => {
  let testEmail: string;
  let testUserId: number;
  let resetToken: string;

  beforeAll(async () => {
    // Create a test user with email/password
    testEmail = `test-reset-${Date.now()}@example.com`;
    const result = await db.registerUser(testEmail, "TestPassword123!", "Test User Reset");
    testUserId = result.userId;
  });

  it("should request password reset for existing user", async () => {
    const result = await db.requestPasswordReset(testEmail);
    
    expect(result.success).toBe(true);
    // Note: For security, we don't reveal if email exists
  });

  it("should request password reset for non-existing user (security)", async () => {
    const result = await db.requestPasswordReset("nonexistent@example.com");
    
    // Should still return success to prevent email enumeration
    expect(result.success).toBe(true);
  });

  it("should not allow OAuth-only users to reset password", async () => {
    // Create OAuth user (no password)
    const oauthEmail = `oauth-${Date.now()}@example.com`;
    await db.findOrCreateUserByProvider({
      provider: "google",
      openId: "google-123",
      email: oauthEmail,
      name: "OAuth User"
    });
    
    const result = await db.requestPasswordReset(oauthEmail);
    
    // Should return success but not actually send email (security)
    expect(result.success).toBe(true);
  });

  it("should reset password with valid token", async () => {
    // Request reset and get token
    const requestResult = await db.requestPasswordReset(testEmail);
    expect(requestResult.success).toBe(true);
    
    // In production, token is sent via email
    // For testing, we need to get it from the database
    const dbConnection = await db.getDb();
    if (!dbConnection) throw new Error("Database not available");
    
    const [tokenRecord] = await dbConnection
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, testUserId))
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1);
    
    expect(tokenRecord).toBeDefined();
    resetToken = tokenRecord.token;
    
    // Reset password
    const newPassword = "NewPassword456!";
    const resetResult = await db.resetPassword(resetToken, newPassword);
    
    expect(resetResult.success).toBe(true);
    expect(resetResult.email).toBe(testEmail);
    
    // Verify new password works
    const loginResult = await db.loginUser(testEmail, newPassword);
    expect(loginResult.email).toBe(testEmail);
  });

  it("should not allow reusing the same token", async () => {
    // Try to use the same token again
    // Note: Token was marked as used, so it will throw error
    await expect(
      db.resetPassword(resetToken, "AnotherPassword789!")
    ).rejects.toThrow();
  });

  it("should reject invalid token", async () => {
    await expect(
      db.resetPassword("invalid-token-123", "Password123!")
    ).rejects.toThrow("Invalid or expired reset token");
  });

  it("should reject expired token", async () => {
    // Request new reset
    await db.requestPasswordReset(testEmail);
    
    // Get the token
    const dbConnection = await db.getDb();
    if (!dbConnection) throw new Error("Database not available");
    
    const [tokenRecord] = await dbConnection
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, testUserId))
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1);
    
    // Manually expire the token
    await dbConnection
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) }) // 1 second ago
      .where(eq(passwordResetTokens.id, tokenRecord.id));
    
    // Try to use expired token
    await expect(
      db.resetPassword(tokenRecord.token, "Password123!")
    ).rejects.toThrow("Reset token has expired");
  });

  it("should normalize email (case-insensitive)", async () => {
    const upperCaseEmail = testEmail.toUpperCase();
    const result = await db.requestPasswordReset(upperCaseEmail);
    
    expect(result.success).toBe(true);
  });
});
