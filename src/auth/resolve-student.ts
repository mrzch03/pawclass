import type { Context } from "hono";
import type { AuthVariables } from "./types.js";

/**
 * Resolve the target student ID based on the caller's role.
 *
 * - student: always returns their own userId
 * - agent: returns studentId from token, or query param, or fallback to own userId
 * - teacher: requires studentId query param, validates against allowed students list
 */
export function resolveStudentId(c: Context<{ Variables: AuthVariables }>): string {
  const role = c.get("role");
  const userId = c.get("userId");

  if (role === "student") {
    return userId;
  }

  if (role === "agent") {
    return c.get("studentId") || c.req.query("studentId") || userId;
  }

  if (role === "teacher") {
    const studentId = c.req.query("studentId");
    if (!studentId) {
      throw new AuthorizationError("Teacher must specify studentId");
    }
    const allowed = c.get("students") || [];
    if (allowed.length > 0 && !allowed.includes(studentId)) {
      throw new AuthorizationError("Not authorized to access this student");
    }
    return studentId;
  }

  return userId;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
