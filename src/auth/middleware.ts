import { createMiddleware } from "hono/factory";
import { jwtVerify, type JWTPayload } from "jose";
import type { AuthVariables } from "./types.js";

const JWT_SECRET = process.env.MISTAKES_JWT_SECRET || "";
const LOGTO_ISSUER = process.env.LOGTO_ISSUER || "";

/**
 * Auth middleware that extracts user identity from the request.
 *
 * Supports two auth modes (all via Authorization: Bearer header):
 * 1. **Logto JWT** (browser): Verify JWT, extract `sub` as userId
 * 2. **OAuth/Delegation token** (CLI/Agent): Verify JWT signature, extract `sub` as userId
 *
 * Sets `c.var.userId` for downstream handlers.
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
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

function extractUserId(payload: JWTPayload): string | null {
  if (typeof payload.sub === "string" && payload.sub.length > 0) {
    return payload.sub;
  }
  return null;
}

function isDelegationToken(payload: JWTPayload): boolean {
  return (payload as Record<string, unknown>).type === "delegation";
}
