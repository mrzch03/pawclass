import { createMiddleware } from "hono/factory";
import { jwtVerify, type JWTPayload } from "jose";
import type { AuthVariables } from "./types.js";

const JWT_SECRET = process.env.MISTAKES_JWT_SECRET || "";
const LOGTO_ISSUER = process.env.LOGTO_ISSUER || "";

/**
 * Verify a JWT token and return the payload. Shared by all auth modes.
 */
async function verifyToken(token: string): Promise<JWTPayload> {
  if (!JWT_SECRET) {
    throw new Error("Server misconfigured: MISTAKES_JWT_SECRET not set");
  }
  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

/**
 * Auth middleware that extracts user identity from the request.
 *
 * Supports three auth modes:
 * 1. **X-API-Key** (CLI/Agent): OAuth access_token as API key — verify JWT signature
 * 2. **Logto JWT** (browser): Verify JWT from Authorization header, extract `sub` as userId
 * 3. **Delegation token** (CLI/Agent): Verify JWT, check `type: "delegation"` claim, extract `sub` as userId
 *
 * Sets `c.var.userId` for downstream handlers.
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // Mode 1: X-API-Key — the value is an OAuth access_token (JWT), verify signature
    const apiKey = c.req.header("X-API-Key");
    if (apiKey) {
      try {
        const payload = await verifyToken(apiKey);
        const userId = extractUserId(payload) || "api-key-user";
        c.set("userId", userId);
        await next();
      } catch (err) {
        const message = err instanceof Error ? err.message : "API key verification failed";
        return c.json({ error: `Unauthorized: ${message}` }, 401);
      }
      return;
    }

    // Mode 2 & 3: Bearer JWT authentication
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token);

      const userId = extractUserId(payload);
      if (!userId) {
        return c.json({ error: "Unauthorized: token missing sub claim" }, 401);
      }

      // If Logto issuer is configured, validate it for non-delegation tokens
      if (LOGTO_ISSUER && !isDelegationToken(payload)) {
        if (payload.iss !== LOGTO_ISSUER) {
          return c.json({ error: "Unauthorized: invalid issuer" }, 401);
        }
      }

      c.set("userId", userId);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token verification failed";
      return c.json({ error: `Unauthorized: ${message}` }, 401);
    }
  }
);

/**
 * Standalone API key middleware — for routes that only accept X-API-Key.
 * The value is an OAuth access_token (JWT), verified by signature.
 */
export const apiKeyMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const apiKey = c.req.header("X-API-Key");
    if (!apiKey) {
      return c.json({ error: "Unauthorized: missing X-API-Key header" }, 401);
    }
    try {
      const payload = await verifyToken(apiKey);
      const userId = extractUserId(payload) || "api-key-user";
      c.set("userId", userId);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "API key verification failed";
      return c.json({ error: `Unauthorized: ${message}` }, 401);
    }
  }
);

function extractUserId(payload: JWTPayload): string | null {
  if (typeof payload.sub === "string" && payload.sub.length > 0) {
    return payload.sub;
  }
  return null;
}

function isDelegationToken(payload: JWTPayload): boolean {
  return (payload as Record<string, unknown>).type === "delegation";
}
