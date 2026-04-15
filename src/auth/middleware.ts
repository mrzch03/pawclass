import { createMiddleware } from "hono/factory";
import { jwtVerify, type JWTPayload } from "jose";
import type { AuthVariables, Role } from "./types.js";

const JWT_SECRET = process.env.MISTAKES_JWT_SECRET || "";
const LOGTO_ISSUER = process.env.LOGTO_ISSUER || "";

/**
 * Auth middleware — extracts user identity and role from JWT.
 *
 * Supports:
 * 1. Logto JWT (browser): sub as userId, role from claim
 * 2. Delegation JWT (CLI/Agent): sub as userId, role/studentId from claims
 * 3. Local dev JWT: sub as userId, role from claim
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
