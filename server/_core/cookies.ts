import type { CookieOptions, Request } from "express";

/**
 * Detect HTTPS behind a reverse proxy (Render).
 * Requires: app.set("trust proxy", 1)
 */
function isHttps(req: Request) {
  const xfProto = req.headers["x-forwarded-proto"];
  if (typeof xfProto === "string")
    return xfProto.split(",").some(p => p.trim().toLowerCase() === "https");
  if (Array.isArray(xfProto))
    return xfProto.some(p => p.trim().toLowerCase() === "https");
  return req.protocol === "https";
}

/**
 * Session cookie options tuned for Render + modern browsers.
 *
 * Default:
 *  - SameSite=Lax (best for single-domain deployments, prevents CSRF in most cases)
 *
 * If you truly need cross-site cookies (separate domains for frontend/backend), set:
 *  - AUTH_COOKIE_SAMESITE=none
 *
 * Notes:
 *  - SameSite=None REQUIRES Secure=true (Chrome/Safari will drop the cookie otherwise)
 *  - Do NOT set `domain` while using *.onrender.com; set it only after you move to your own domain.
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const sameSiteEnv = (process.env.AUTH_COOKIE_SAMESITE || "lax").toLowerCase();
  const sameSite = (sameSiteEnv === "none" ? "none" : "lax") as "lax" | "none";

  const secure = sameSite === "none" ? true : isHttps(req);

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
    // domain: undefined, // set only after custom domain is live, if needed
  };
}
