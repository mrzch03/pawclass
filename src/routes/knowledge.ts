import { Hono } from "hono";
import type { KnowledgeService } from "../knowledge/knowledge-service.js";

const DEFAULT_COURSE = "middle/grade7-up/english";

export function createKnowledgeRoutes(kb: KnowledgeService): Hono {
  const api = new Hono();

  // GET /kb/courses
  api.get("/courses", (c) => c.json(kb.listCourses()));

  // GET /kb/syllabus?course=xxx
  api.get("/syllabus", (c) => {
    const courseId = c.req.query("course") || DEFAULT_COURSE;
    return c.json(kb.getSyllabus(courseId));
  });

  // GET /kb/concepts?course=xxx
  api.get("/concepts", (c) => {
    const courseId = c.req.query("course") || DEFAULT_COURSE;
    return c.json(kb.listConcepts(courseId));
  });

  // GET /kb/concepts/:conceptId?course=xxx
  api.get("/concepts/:conceptId", (c) => {
    const courseId = c.req.query("course") || DEFAULT_COURSE;
    const conceptId = c.req.param("conceptId");
    const detail = kb.getConcept(courseId, conceptId);
    if (!detail) return c.json({ error: "concept not found" }, 404);
    return c.json(detail);
  });

  // GET /kb/exercises?course=xxx
  api.get("/exercises", (c) => {
    const courseId = c.req.query("course") || DEFAULT_COURSE;
    return c.json(kb.getExerciseIndex(courseId));
  });

  // GET /kb/exercises/:conceptId?course=xxx&limit=N
  api.get("/exercises/:conceptId", (c) => {
    const courseId = c.req.query("course") || DEFAULT_COURSE;
    const conceptId = c.req.param("conceptId");
    const difficulty = c.req.query("difficulty") ? parseInt(c.req.query("difficulty")!) : undefined;
    const type = c.req.query("type") || undefined;
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
    return c.json(kb.getExercises(courseId, conceptId, { difficulty, type, limit }));
  });

  // GET /kb/assets?course=xxx&unit=xxx
  api.get("/assets", (c) => {
    const courseId = c.req.query("course") || DEFAULT_COURSE;
    const unit = c.req.query("unit") || undefined;
    return c.json(kb.getAssets(courseId, unit));
  });

  return api;
}
