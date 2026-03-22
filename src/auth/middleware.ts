import { createMiddleware } from "hono/factory";
import { jwtVerify, type JWTPayload } from "jose";
import type { AuthVariables } from "./types.js";

const JWT_SECRET = process.env.MISTAKES_JWT_SECRET || "";
const LOGTO_ISSUER = process.env.LOGTO_ISSUER || "";
const API_KEY = process.env.PAWCLASS_API_KEY || "";
const API_KEY_USER_ID = process.env.PAWCLASS_USER_ID || "default";

/**
 * Auth middleware that extracts user identity from the request.
 *
 * Supports three auth modes:
 * 1. **API Key** (CLI/Agent): X-API-Key header → verify against PAWCLASS_API_KEY env
 * 2. **Logto JWT** (browser): Verify JWT from Authorization header, extract `sub` as userId
 * 3. **Delegation token** (CLI/Agent): Verify JWT, check `type: "delegation"` claim, extract `sub` as userId
 *
 * Sets `c.var.userId` for downstream handlers.
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // Mode 1: API Key authentication
    const apiKey = c.req.header("X-API-Key");
    if (apiKey) {
      if (!API_KEY) {
        return c.json({ error: "Server misconfigured: PAWCLASS_API_KEY not set" }, 500);
      }
      if (apiKey !== API_KEY) {
        return c.json({ error: "Unauthorized: invalid API key" }, 401);
      }
      c.set("userId", API_KEY_USER_ID);
      await next();
      return;
    }

    // Mode 2 & 3: JWT authentication
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    if (!JWT_SECRET) {
      return c.json({ error: "Server misconfigured: MISTAKES_JWT_SECRET not set" }, 500);
    }

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

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
 * Standalone API key middleware — for routes that only accept API key auth.
 */
export const apiKeyMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const apiKey = c.req.header("X-API-Key");
    if (!apiKey) {
      return c.json({ error: "Unauthorized: missing X-API-Key header" }, 401);
    }
    if (!API_KEY) {
      return c.json({ error: "Server misconfigured: PAWCLASS_API_KEY not set" }, 500);
    }
    if (apiKey !== API_KEY) {
      return c.json({ error: "Unauthorized: invalid API key" }, 401);
    }
    c.set("userId", API_KEY_USER_ID);
    await next();
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
