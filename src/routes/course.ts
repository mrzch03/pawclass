/**
 * Course HTTP API routes.
 *
 * Atomic course creation: create empty → add scenes/actions → finalize → play.
 * Each "add" endpoint creates or appends content and broadcasts SSE events.
 */

import { Hono } from "hono";
import { stream } from "hono/streaming";
import { nanoid } from "nanoid";
import { courseStore } from "../stage/course-store.js";
import { assertCourseTransition, canAddContent } from "../stage/course-types.js";
import {
  buildSlideScene,
  buildCodeScene,
  buildQuizScene,
  buildInteractiveScene,
  buildNarrationAction,
  buildWhiteboardAction,
} from "../stage/course-builder.js";
import type { ServerPlaybackEngine } from "../stage/playback/server-engine.js";
import type { AuthVariables } from "../auth/types.js";
import type { MiddlewareHandler } from "hono";

export interface CourseRouterDeps {
  engine: ServerPlaybackEngine;
  baseUrl: string;
  authMiddleware: MiddlewareHandler;
}

export function createCourseRoutes(deps: CourseRouterDeps) {
  const { engine, baseUrl, authMiddleware: auth } = deps;
  const app = new Hono<{ Variables: AuthVariables }>();

  // POST /api/course — create a new empty course (auth required)
  app.post("/", auth, async (c) => {
    const body = await c.req.json<{ title: string }>();
    if (!body.title) {
      return c.json({ error: "title is required" }, 400);
    }

    const id = `crs_${nanoid(12)}`;
    const course = courseStore.create(id, body.title);

    return c.json({
      id: course.id,
      url: `${baseUrl}/course/${course.id}`,
      status: course.status,
    }, 201);
  });

  // GET /api/course/:id — query course state
  app.get("/:id", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    return c.json({
      id: course.id,
      status: course.status,
      title: course.title,
      sceneCount: course.scenes.length,
      currentStepIndex: course.currentStepIndex,
      createdAt: course.createdAt,
      startedAt: course.startedAt,
      completedAt: course.completedAt,
    });
  });

  // POST /api/course/:id/finalize — mark course as finalized
  app.post("/:id/finalize", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);

    try {
      assertCourseTransition(course.status, "finalized");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    courseStore.updateStatus(course.id, "finalized");
    engine.broadcast(course.id, {
      type: "course_finalized",
      totalScenes: course.scenes.length,
    });

    return c.json({ id: course.id, status: "finalized", sceneCount: course.scenes.length });
  });

  // POST /api/course/:id/play
  app.post("/:id/play", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (course.scenes.length === 0) {
      return c.json({ error: "cannot play empty course" }, 400);
    }

    try {
      assertCourseTransition(course.status, "playing");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    courseStore.updateStatus(course.id, "playing");
    engine.play(course.id);

    return c.json({ id: course.id, status: "playing" });
  });

  // POST /api/course/:id/pause
  app.post("/:id/pause", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);

    try {
      assertCourseTransition(course.status, "paused");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    courseStore.updateStatus(course.id, "paused");
    engine.pause(course.id);

    return c.json({ id: course.id, status: "paused" });
  });

  // POST /api/course/:id/resume
  app.post("/:id/resume", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);

    try {
      assertCourseTransition(course.status, "playing");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    courseStore.updateStatus(course.id, "playing");
    engine.resume(course.id);

    return c.json({ id: course.id, status: "playing" });
  });

  // POST /api/course/:id/stop
  app.post("/:id/stop", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);

    try {
      assertCourseTransition(course.status, "ended");
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }

    courseStore.updateStatus(course.id, "ended");
    engine.stop(course.id);

    return c.json({ id: course.id, status: "ended" });
  });

  // GET /api/course/:id/results — quiz results
  app.get("/:id/results", auth, (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    return c.json({
      id: course.id,
      quizResults: course.quizResults,
      totalQuizzes: course.quizResults.length,
    });
  });

  // -----------------------------------------------------------------------
  // Content addition endpoints (create new Scene or append to last Scene)
  // -----------------------------------------------------------------------

  // POST /api/course/:id/slide — add a slide scene
  app.post("/:id/slide", auth, async (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (!canAddContent(course.status)) {
      return c.json({ error: `cannot add content in ${course.status} state` }, 400);
    }

    const body = await c.req.json<{ title: string; content: string }>();
    if (!body.title || !body.content) {
      return c.json({ error: "title and content are required" }, 400);
    }

    const scene = buildSlideScene({ title: body.title, content: body.content });
    const sceneIndex = courseStore.addScene(course.id, scene)!;

    engine.broadcast(course.id, {
      type: "scene_added",
      sceneIndex,
      scene,
      totalScenes: course.scenes.length,
    });

    return c.json({ sceneIndex, sceneId: scene.id });
  });

  // POST /api/course/:id/code — add a code scene
  app.post("/:id/code", auth, async (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (!canAddContent(course.status)) {
      return c.json({ error: `cannot add content in ${course.status} state` }, 400);
    }

    const body = await c.req.json<{ language: string; content: string; title?: string }>();
    if (!body.language || !body.content) {
      return c.json({ error: "language and content are required" }, 400);
    }

    const scene = buildCodeScene({ language: body.language, content: body.content, title: body.title });
    const sceneIndex = courseStore.addScene(course.id, scene)!;

    engine.broadcast(course.id, {
      type: "scene_added",
      sceneIndex,
      scene,
      totalScenes: course.scenes.length,
    });

    return c.json({ sceneIndex, sceneId: scene.id });
  });

  // POST /api/course/:id/quiz — add a quiz scene
  app.post("/:id/quiz", auth, async (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (!canAddContent(course.status)) {
      return c.json({ error: `cannot add content in ${course.status} state` }, 400);
    }

    const body = await c.req.json<{ question: string; options: string[]; answer: number }>();
    if (!body.question || !body.options?.length || body.answer == null) {
      return c.json({ error: "question, options, and answer are required" }, 400);
    }

    const scene = buildQuizScene({ question: body.question, options: body.options, answer: body.answer });
    const sceneIndex = courseStore.addScene(course.id, scene)!;

    engine.broadcast(course.id, {
      type: "scene_added",
      sceneIndex,
      scene,
      totalScenes: course.scenes.length,
    });

    return c.json({ sceneIndex, sceneId: scene.id });
  });

  // POST /api/course/:id/interactive — add an interactive scene
  app.post("/:id/interactive", auth, async (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (!canAddContent(course.status)) {
      return c.json({ error: `cannot add content in ${course.status} state` }, 400);
    }

    const body = await c.req.json<{ type: string; language?: string }>();
    if (!body.type) {
      return c.json({ error: "type is required" }, 400);
    }

    const scene = buildInteractiveScene({ type: body.type, language: body.language });
    const sceneIndex = courseStore.addScene(course.id, scene)!;

    engine.broadcast(course.id, {
      type: "scene_added",
      sceneIndex,
      scene,
      totalScenes: course.scenes.length,
    });

    return c.json({ sceneIndex, sceneId: scene.id });
  });

  // POST /api/course/:id/narration — add narration to last scene
  app.post("/:id/narration", auth, async (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (!canAddContent(course.status)) {
      return c.json({ error: `cannot add content in ${course.status} state` }, 400);
    }
    if (course.scenes.length === 0) {
      return c.json({ error: "no scenes to add narration to — add a scene first" }, 400);
    }

    const body = await c.req.json<{ text: string }>();
    if (!body.text) {
      return c.json({ error: "text is required" }, 400);
    }

    const action = buildNarrationAction({ text: body.text });
    const result = courseStore.addActionToLastScene(course.id, action)!;

    engine.broadcast(course.id, {
      type: "action_added",
      sceneIndex: result.sceneIndex,
      actionId: result.actionId,
      action,
    });

    return c.json({ sceneIndex: result.sceneIndex, actionId: result.actionId });
  });

  // POST /api/course/:id/whiteboard — add whiteboard action to last scene
  app.post("/:id/whiteboard", auth, async (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);
    if (!canAddContent(course.status)) {
      return c.json({ error: `cannot add content in ${course.status} state` }, 400);
    }
    if (course.scenes.length === 0) {
      return c.json({ error: "no scenes to add whiteboard to — add a scene first" }, 400);
    }

    const body = await c.req.json<{
      type: "text" | "shape" | "latex" | "line";
      content?: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      fontSize?: number;
      color?: string;
      shape?: "rectangle" | "circle" | "triangle";
    }>();
    if (!body.type || body.x == null || body.y == null) {
      return c.json({ error: "type, x, and y are required" }, 400);
    }

    const action = buildWhiteboardAction(body);
    const result = courseStore.addActionToLastScene(course.id, action)!;

    engine.broadcast(course.id, {
      type: "action_added",
      sceneIndex: result.sceneIndex,
      actionId: result.actionId,
      action,
    });

    return c.json({ sceneIndex: result.sceneIndex, actionId: result.actionId });
  });

  // -----------------------------------------------------------------------
  // Public endpoints (no auth — accessed by browser)
  // -----------------------------------------------------------------------

  // SSE streaming
  app.get("/:id/stream", (c) => {
    const courseId = c.req.param("id");
    const course = courseStore.get(courseId);
    if (!course) return c.json({ error: "course not found" }, 404);

    return stream(c, async (s) => {
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      const unsubscribe = engine.subscribe(courseId, (event) => {
        try { s.write(`data: ${JSON.stringify(event)}\n\n`); } catch {}
      });

      s.write(`data: ${JSON.stringify({
        type: "init",
        status: course.status,
        currentStepIndex: course.currentStepIndex,
        totalSteps: course.scenes.length,
        scenes: course.scenes,
      })}\n\n`);

      s.onAbort(() => unsubscribe());
      await new Promise(() => {});
    });
  });

  app.post("/:id/step-complete", async (c) => {
    const body = await c.req.json<{ stepIndex: number }>();
    await engine.onStepComplete(c.req.param("id"), body.stepIndex);
    return c.json({ ok: true });
  });

  app.post("/:id/quiz-submit", async (c) => {
    const body = await c.req.json<{ stepIndex: number; result: any }>();
    await engine.onQuizSubmit(c.req.param("id"), body.stepIndex, body.result);
    return c.json({ ok: true });
  });

  // POST /api/course/:id/replay — reset course to finalized + step 0
  app.post("/:id/replay", (c) => {
    const course = courseStore.get(c.req.param("id"));
    if (!course) return c.json({ error: "course not found" }, 404);

    courseStore.updateStatus(course.id, "finalized");
    courseStore.setCurrentStep(course.id, 0);

    return c.json({ id: course.id, status: "finalized", currentStepIndex: 0 });
  });

  return app;
}
