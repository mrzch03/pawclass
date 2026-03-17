import { eq, desc, and, like } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import { mistakes, type Mistake } from "../db/schema.js";

export interface MistakeRepo {
  create(userId: string, params: {
    subject: string;
    topic?: string;
    problemText: string;
    problemImageUrl?: string;
    wrongAnswer?: string;
    correctAnswer?: string;
    explanation?: string;
    difficulty?: number;
    source?: string;
    tags?: string[];
  }): Promise<Mistake>;

  list(userId: string, opts?: {
    subject?: string;
    topic?: string;
    mastered?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Mistake[]>;

  getById(userId: string, id: string): Promise<Mistake | null>;

  update(userId: string, id: string, params: Partial<{
    subject: string;
    topic: string;
    problemText: string;
    problemImageUrl: string;
    wrongAnswer: string;
    correctAnswer: string;
    explanation: string;
    difficulty: number;
    source: string;
    tags: string[];
  }>): Promise<Mistake | null>;

  remove(userId: string, id: string): Promise<boolean>;

  markMastered(userId: string, id: string): Promise<Mistake | null>;

  stats(userId: string, subject?: string): Promise<{
    total: number;
    mastered: number;
    unmastered: number;
    bySubject: { subject: string; count: number; mastered: number }[];
    weakTopics: { topic: string; count: number }[];
  }>;
}

export function createMistakeRepo(db: DB): MistakeRepo {
  return {
    async create(userId, params) {
      const now = new Date().toISOString();

      const [created] = await db.insert(mistakes).values({
        userId,
        subject: params.subject,
        topic: params.topic ?? null,
        problemText: params.problemText,
        problemImageUrl: params.problemImageUrl ?? null,
        wrongAnswer: params.wrongAnswer ?? null,
        correctAnswer: params.correctAnswer ?? null,
        explanation: params.explanation ?? null,
        difficulty: params.difficulty ?? 3,
        source: params.source ?? null,
        tags: params.tags ? JSON.stringify(params.tags) : null,
        mastered: false,
        createdAt: now,
        updatedAt: now,
      }).returning();

      return created;
    },

    async list(userId, opts) {
      const conditions = [eq(mistakes.userId, userId)];
      if (opts?.subject) conditions.push(eq(mistakes.subject, opts.subject));
      if (opts?.topic) conditions.push(like(mistakes.topic, `%${opts.topic}%`));
      if (opts?.mastered === true) conditions.push(eq(mistakes.mastered, true));
      if (opts?.mastered === false) conditions.push(eq(mistakes.mastered, false));

      let query = db.select().from(mistakes).where(and(...conditions));
      query = query.orderBy(desc(mistakes.createdAt)) as any;
      if (opts?.limit) query = query.limit(opts.limit) as any;
      if (opts?.offset) query = query.offset(opts.offset) as any;

      return query;
    },

    async getById(userId, id) {
      const [found] = await db.select().from(mistakes)
        .where(and(eq(mistakes.id, id), eq(mistakes.userId, userId)))
        .limit(1);
      return found ?? null;
    },

    async update(userId, id, params) {
      const existing = await this.getById(userId, id);
      if (!existing) return null;

      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (params.subject !== undefined) updates.subject = params.subject;
      if (params.topic !== undefined) updates.topic = params.topic;
      if (params.problemText !== undefined) updates.problemText = params.problemText;
      if (params.problemImageUrl !== undefined) updates.problemImageUrl = params.problemImageUrl;
      if (params.wrongAnswer !== undefined) updates.wrongAnswer = params.wrongAnswer;
      if (params.correctAnswer !== undefined) updates.correctAnswer = params.correctAnswer;
      if (params.explanation !== undefined) updates.explanation = params.explanation;
      if (params.difficulty !== undefined) updates.difficulty = params.difficulty;
      if (params.source !== undefined) updates.source = params.source;
      if (params.tags !== undefined) updates.tags = JSON.stringify(params.tags);

      await db.update(mistakes).set(updates)
        .where(and(eq(mistakes.id, id), eq(mistakes.userId, userId)));
      return this.getById(userId, id);
    },

    async remove(userId, id) {
      const existing = await this.getById(userId, id);
      if (!existing) return false;

      // Reviews have FK constraint; delete them first
      const { reviews } = await import("../db/schema.js");
      await db.delete(reviews).where(eq(reviews.mistakeId, id));
      const result = await db.delete(mistakes)
        .where(and(eq(mistakes.id, id), eq(mistakes.userId, userId)));
      return (result as any).rowCount > 0;
    },

    async markMastered(userId, id) {
      const existing = await this.getById(userId, id);
      if (!existing) return null;

      const now = new Date().toISOString();
      await db.update(mistakes).set({
        mastered: true,
        masteredAt: now,
        updatedAt: now,
      }).where(and(eq(mistakes.id, id), eq(mistakes.userId, userId)));

      return this.getById(userId, id);
    },

    async stats(userId, subject?) {
      const conditions = [eq(mistakes.userId, userId)];
      if (subject) conditions.push(eq(mistakes.subject, subject));

      const allMistakes = await db.select().from(mistakes).where(and(...conditions));

      const total = allMistakes.length;
      const mastered = allMistakes.filter(m => m.mastered).length;

      // Group by subject
      const subjectMap = new Map<string, { count: number; mastered: number }>();
      for (const m of allMistakes) {
        const entry = subjectMap.get(m.subject) ?? { count: 0, mastered: 0 };
        entry.count++;
        if (m.mastered) entry.mastered++;
        subjectMap.set(m.subject, entry);
      }
      const bySubject = Array.from(subjectMap.entries()).map(([subject, data]) => ({
        subject,
        ...data,
      }));

      // Weak topics (unmastered, grouped by topic)
      const topicMap = new Map<string, number>();
      for (const m of allMistakes) {
        if (!m.mastered && m.topic) {
          topicMap.set(m.topic, (topicMap.get(m.topic) ?? 0) + 1);
        }
      }
      const weakTopics = Array.from(topicMap.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { total, mastered, unmastered: total - mastered, bySubject, weakTopics };
    },
  };
}
