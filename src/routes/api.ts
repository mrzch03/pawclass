import { Hono } from "hono";
import type { MistakeRepo } from "../repo/mistake-repo.js";
import type { ReviewRepo } from "../repo/review-repo.js";
import type { AuthVariables } from "../auth/types.js";

export interface ApiDeps {
  mistakeRepo: MistakeRepo;
  reviewRepo: ReviewRepo;
}

export function createApiRoutes(deps: ApiDeps): Hono<{ Variables: AuthVariables }> {
  const api = new Hono<{ Variables: AuthVariables }>();
  const { mistakeRepo, reviewRepo } = deps;

  // POST /mistake — create
  api.post("/mistake", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => null);
    if (!body || !body.subject || !body.problemText) {
      return c.json({ error: "subject and problemText are required" }, 400);
    }

    const mistake = await mistakeRepo.create(userId, {
      subject: body.subject,
      topic: body.topic,
      problemText: body.problemText,
      problemImageUrl: body.problemImageUrl,
      wrongAnswer: body.wrongAnswer,
      correctAnswer: body.correctAnswer,
      explanation: body.explanation,
      difficulty: body.difficulty,
      source: body.source,
      tags: body.tags,
    });

    return c.json(mistake, 201);
  });

  // GET /mistake — list
  api.get("/mistake", async (c) => {
    const userId = c.get("userId");
    const subject = c.req.query("subject");
    const topic = c.req.query("topic");
    const masteredParam = c.req.query("mastered");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    let mastered: boolean | undefined;
    if (masteredParam === "true") mastered = true;
    if (masteredParam === "false") mastered = false;

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    if (limitParam && (isNaN(limit!) || limit! < 0)) {
      return c.json({ error: "limit must be a non-negative number" }, 400);
    }
    if (offsetParam && (isNaN(offset!) || offset! < 0)) {
      return c.json({ error: "offset must be a non-negative number" }, 400);
    }

    const list = await mistakeRepo.list(userId, { subject, topic, mastered, limit, offset });
    return c.json(list);
  });

  // GET /mistake/:id — get one
  api.get("/mistake/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const mistake = await mistakeRepo.getById(userId, id);
    if (!mistake) {
      return c.json({ error: "Mistake not found" }, 404);
    }
    return c.json(mistake);
  });

  // PATCH /mistake/:id — update
  api.patch("/mistake/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({ error: "Request body is required" }, 400);
    }

    const updated = await mistakeRepo.update(userId, id, {
      subject: body.subject,
      topic: body.topic,
      problemText: body.problemText,
      problemImageUrl: body.problemImageUrl,
      wrongAnswer: body.wrongAnswer,
      correctAnswer: body.correctAnswer,
      explanation: body.explanation,
      difficulty: body.difficulty,
      source: body.source,
      tags: body.tags,
    });

    if (!updated) {
      return c.json({ error: "Mistake not found" }, 404);
    }
    return c.json(updated);
  });

  // DELETE /mistake/:id — delete
  api.delete("/mistake/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const deleted = await mistakeRepo.remove(userId, id);
    if (!deleted) {
      return c.json({ error: "Mistake not found" }, 404);
    }
    return c.body(null, 204);
  });

  // POST /mistake/:id/master — mark mastered
  api.post("/mistake/:id/master", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const mastered = await mistakeRepo.markMastered(userId, id);
    if (!mastered) {
      return c.json({ error: "Mistake not found" }, 404);
    }
    return c.json(mastered);
  });

  // POST /mistake/:id/review — log review
  api.post("/mistake/:id/review", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    // Verify mistake exists and belongs to user
    const mistake = await mistakeRepo.getById(userId, id);
    if (!mistake) {
      return c.json({ error: "Mistake not found" }, 404);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || !body.result) {
      return c.json({ error: "result is required (correct, wrong, or partial)" }, 400);
    }
    if (!["correct", "wrong", "partial"].includes(body.result)) {
      return c.json({ error: "result must be one of: correct, wrong, partial" }, 400);
    }

    const review = await reviewRepo.logReview(userId, {
      mistakeId: id,
      result: body.result,
      note: body.note,
    });
    return c.json(review, 201);
  });

  // GET /mistake/:id/review — review history
  api.get("/mistake/:id/review", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    // Verify mistake exists and belongs to user
    const mistake = await mistakeRepo.getById(userId, id);
    if (!mistake) {
      return c.json({ error: "Mistake not found" }, 404);
    }

    const history = await reviewRepo.getHistory(userId, id);
    return c.json(history);
  });

  // GET /review/due — due for review
  api.get("/review/due", async (c) => {
    const userId = c.get("userId");
    const subject = c.req.query("subject");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    if (limitParam && (isNaN(limit!) || limit! < 0)) {
      return c.json({ error: "limit must be a non-negative number" }, 400);
    }

    const due = await reviewRepo.getDue(userId, { subject, limit });
    return c.json(due);
  });

  // GET /stats — analytics
  api.get("/stats", async (c) => {
    const userId = c.get("userId");
    const subject = c.req.query("subject");
    const stats = await mistakeRepo.stats(userId, subject);
    return c.json(stats);
  });

  return api;
}
