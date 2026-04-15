import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import { teachingDirectives } from "../db/schema.js";
import type { AuthVariables } from "../auth/types.js";

/**
 * Directive routes — for Agent to read and complete teaching directives.
 * Teachers create directives via /api/teacher/directive.
 * Agents read pending directives and mark them done after execution.
 */
export function createDirectiveRoutes(db: DB): Hono<{ Variables: AuthVariables }> {
  const api = new Hono<{ Variables: AuthVariables }>();

  // GET /directive/pending — get pending directives for a student
  api.get("/pending", async (c) => {
    const studentId = c.req.query("studentId") || c.get("studentId") || "";
    if (!studentId) return c.json({ error: "studentId required" }, 400);

    const rows = await db
      .select()
      .from(teachingDirectives)
      .where(and(
        eq(teachingDirectives.studentId, studentId),
        eq(teachingDirectives.status, "pending"),
      ));

    return c.json(rows);
  });

  // POST /directive/:id/start — mark directive as executing
  api.post("/:id/start", async (c) => {
    const id = c.req.param("id");
    await db
      .update(teachingDirectives)
      .set({ status: "executing" })
      .where(eq(teachingDirectives.id, id));
    return c.json({ ok: true });
  });

  // POST /directive/:id/complete — mark directive as done
  api.post("/:id/complete", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    await db
      .update(teachingDirectives)
      .set({
        status: "done",
        agentNote: body.note || null,
        resultRefs: body.resultRefs || null,
        completedAt: new Date().toISOString(),
      })
      .where(eq(teachingDirectives.id, id));

    return c.json({ ok: true });
  });

  // POST /directive/:id/dismiss — dismiss a directive
  api.post("/:id/dismiss", async (c) => {
    const id = c.req.param("id");
    await db
      .update(teachingDirectives)
      .set({ status: "dismissed" })
      .where(eq(teachingDirectives.id, id));
    return c.json({ ok: true });
  });

  return api;
}
