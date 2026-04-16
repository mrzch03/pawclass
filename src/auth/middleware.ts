import { createMiddleware } from "hono/factory";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import type { AuthVariables, Role } from "./types.js";

const JWT_SECRET = process.env.MISTAKES_JWT_SECRET || "";
const CLERK_ISSUER = process.env.CLERK_ISSUER || "";  // e.g. "https://innocent-raccoon-97.clerk.accounts.dev"

// Clerk JWKS endpoint (cached by jose)
let clerkJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
function getClerkJWKS() {
  if (!clerkJWKS && CLERK_ISSUER) {
    clerkJWKS = createRemoteJWKSet(new URL(`${CLERK_ISSUER}/.well-known/jwks.json`));
  }
  return clerkJWKS;
}

/**
 * Auth middleware — supports multiple JWT sources:
 * 1. Clerk JWT (browser, RS256): verified via JWKS
 * 2. Local/Delegation JWT (HS256): verified via shared secret
 *
 * Sets: c.var.userId, c.var.role, c.var.students, c.var.studentId
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      let payload: JWTPayload;

      // Try Clerk JWKS first (if configured and token looks like Clerk JWT)
      const jwks = getClerkJWKS();
      if (jwks && isLikelyClerkToken(token)) {
        try {
          const result = await jwtVerify(token, jwks, { issuer: CLERK_ISSUER });
          payload = result.payload;
        } catch {
          // Fall through to local secret
          payload = await verifyLocalToken(token);
        }
      } else {
        payload = await verifyLocalToken(token);
      }

      const userId = extractUserId(payload);
      if (!userId) {
        return c.json({ error: "Unauthorized: token missing sub claim" }, 401);
      }

      c.set("userId", userId);
      c.set("role", extractRole(payload));
      c.set("students", extractStudents(payload));
      c.set("studentId", extractStudentId(payload));

      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token verification failed";
      return c.json({ error: `Unauthorized: ${message}` }, 401);
    }
  }
);

async function verifyLocalToken(token: string): Promise<JWTPayload> {
  if (!JWT_SECRET) {
    throw new Error("Server misconfigured: MISTAKES_JWT_SECRET not set");
  }
  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

/** Clerk tokens have 3 parts and the header contains "kid" */
function isLikelyClerkToken(token: string): boolean {
  try {
    const header = JSON.parse(atob(token.split(".")[0]));
    return !!header.kid;
  } catch {
    return false;
  }
}

function extractUserId(payload: JWTPayload): string | null {
  if (typeof payload.sub === "string" && payload.sub.length > 0) {
    return payload.sub;
  }
  return null;
}

function extractRole(payload: JWTPayload): Role {
  const p = payload as Record<string, unknown>;
  if (p.role === "teacher" || p.role === "agent" || p.role === "student") {
    return p.role as Role;
  }
  if (isDelegationToken(payload)) return "agent";
  return "student";
}

function extractStudents(payload: JWTPayload): string[] | undefined {
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.students)) return p.students as string[];
  return undefined;
}

function extractStudentId(payload: JWTPayload): string | undefined {
  const p = payload as Record<string, unknown>;
  if (typeof p.studentId === "string") return p.studentId;
  return undefined;
}

function isDelegationToken(payload: JWTPayload): boolean {
  return (payload as Record<string, unknown>).type === "delegation";
}
