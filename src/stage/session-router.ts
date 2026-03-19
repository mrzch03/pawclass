/**
 * Session HTTP API routes.
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import { sessionStore } from "./session-store.js";
import { assertTransition } from "./session-types.js";
import type { TeachingOutline } from "./types.js";

export interface SessionRouterDeps {
  /** Called when a session is created — triggers async content generation */
  onSessionCreated?: (sessionId: string) => void;
  /** Called for playback control commands */
  onPlay?: (sessionId: string) => void;
  onPause?: (sessionId: string) => void;
  onResume?: (sessionId: string) => void;
  onGoto?: (sessionId: string, stepIndex: number) => void;
  onStop?: (sessionId: string) => void;
}

export function createSessionRouter(deps: SessionRouterDeps = {}) {
  const app = new Hono();

  // POST /api/session — create a new session with an outline
  app.post("/", async (c) => {
    const body = await c.req.json<{ outline: TeachingOutline }>();
    if (!body.outline?.steps?.length) {
      return c.json({ error: "outline with steps is required" }, 400);
    }

    const id = `ses_${nanoid(12)}`;
    const session = sessionStore.create(id, body.outline);

    // Transition to generating and kick off content generation
    assertTransition(session.status, "generating");
    sessionStore.updateStatus(id, "generating");

    deps.onSessionCreated?.(id);

    return c.json({
      id: session.id,
      status: "generating",
      outline: session.outline,
    }, 201);
  });

  // GET /api/session/:id — query session state
  app.get("/:id", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);
    return c.json({
      id: session.id,
      status: session.status,
      currentStepIndex: session.currentStepIndex,
      totalSteps: session.scenes.length || session.outline.steps.length,
      outline: session.outline,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    });
  });

  // POST /api/session/:id/play — start playback
  app.post("/:id/play", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    try {
      assertTransition(session.status, "playing");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    sessionStore.updateStatus(session.id, "playing");
    deps.onPlay?.(session.id);

    return c.json({ id: session.id, status: "playing" });
  });

  // POST /api/session/:id/pause — pause playback
  app.post("/:id/pause", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    try {
      assertTransition(session.status, "paused");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    sessionStore.updateStatus(session.id, "paused");
    deps.onPause?.(session.id);

    return c.json({ id: session.id, status: "paused" });
  });

  // POST /api/session/:id/resume — resume from paused
  app.post("/:id/resume", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    try {
      assertTransition(session.status, "playing");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    sessionStore.updateStatus(session.id, "playing");
    deps.onResume?.(session.id);

    return c.json({ id: session.id, status: "playing" });
  });

  // POST /api/session/:id/goto — jump to a specific step
  app.post("/:id/goto", async (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    const body = await c.req.json<{ stepIndex: number }>();
    if (body.stepIndex == null || body.stepIndex < 0 || body.stepIndex >= session.scenes.length) {
      return c.json({ error: "invalid stepIndex" }, 400);
    }

    sessionStore.setCurrentStep(session.id, body.stepIndex);
    deps.onGoto?.(session.id, body.stepIndex);

    return c.json({ id: session.id, currentStepIndex: body.stepIndex });
  });

  // POST /api/session/:id/stop — end session
  app.post("/:id/stop", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    try {
      assertTransition(session.status, "ended");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    sessionStore.updateStatus(session.id, "ended");
    deps.onStop?.(session.id);

    return c.json({ id: session.id, status: "ended" });
  });

  // GET /api/session/:id/results — quiz results
  app.get("/:id/results", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    return c.json({
      id: session.id,
      quizResults: session.quizResults,
      totalQuizzes: session.quizResults.length,
    });
  });

  return app;
}
