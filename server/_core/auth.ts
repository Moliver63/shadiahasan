import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const isProd = process.env.NODE_ENV === "production";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;
if (isProd && !JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

const ACCESS_TOKEN_SECRET = JWT_SECRET || "dev-access-secret";
const REFRESH_TOKEN_SECRET = JWT_SECRET ? `${JWT_SECRET}-refresh` : "dev-refresh-secret";
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "30d"; // 30 days

export interface JWTPayload {
  sub: number; // user ID
  email: string;
  name?: string;
  role?: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plain password with a hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate an access token (short-lived)
 */
export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generate a refresh token (long-lived)
 */
export function signRefreshToken(payload: { sub: number }): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (typeof decoded === "string") {
      throw new Error("Invalid token format");
    }
    return decoded as unknown as JWTPayload;
  } catch {
    throw new Error("Invalid or expired access token");
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): { sub: number } {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    if (typeof decoded === "string") {
      throw new Error("Invalid token format");
    }
    return { sub: Number((decoded as any).sub) };
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
}

/**
 * Generate a random token for email verification or password reset
 */
export function generateRandomToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Minimum 8 characters, at least one letter and one number
 */
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

/**
 * Set authentication cookies
 */
export function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  const cookieBase = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };

  res.cookie("access_token", accessToken, {
    ...cookieBase,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refresh_token", refreshToken, {
    ...cookieBase,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(res: any) {
  const cookieBase = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };

  res.clearCookie("access_token", cookieBase);
  res.clearCookie("refresh_token", cookieBase);
}
