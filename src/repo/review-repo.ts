import { eq, desc, and } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import { reviews, mistakes, type Review } from "../db/schema.js";

export interface ReviewRepo {
  /** Log a review result for a mistake (verifies ownership via userId) */
  logReview(userId: string, params: {
    mistakeId: string;
    result: "correct" | "wrong" | "partial";
    note?: string;
  }): Promise<Review>;

  /** Get review history for a specific mistake (scoped to userId) */
  getHistory(userId: string, mistakeId: string): Promise<Review[]>;

  /** Get mistakes due for review (spaced repetition, scoped to userId) */
  getDue(userId: string, opts?: { subject?: string; limit?: number }): Promise<Array<{
    id: string;
    subject: string;
    topic: string | null;
    problemText: string;
    difficulty: number;
    reviewCount: number;
    lastReviewAt: string | null;
  }>>;
}

export function createReviewRepo(db: DB): ReviewRepo {
  return {
    async logReview(userId, params) {
      // Verify the mistake belongs to this user
      const [mistake] = await db.select().from(mistakes)
        .where(and(eq(mistakes.id, params.mistakeId), eq(mistakes.userId, userId)))
        .limit(1);

      if (!mistake) {
        throw new Error("Mistake not found or not owned by user");
      }

      const now = new Date().toISOString();

      const [created] = await db.insert(reviews).values({
        userId,
        mistakeId: params.mistakeId,
        result: params.result,
        note: params.note ?? null,
        createdAt: now,
      }).returning();

      return created;
    },

    async getHistory(userId, mistakeId) {
      // Join with mistakes to verify ownership
      const [mistake] = await db.select().from(mistakes)
        .where(and(eq(mistakes.id, mistakeId), eq(mistakes.userId, userId)))
        .limit(1);

      if (!mistake) {
        return [];
      }

      return db.select().from(reviews)
        .where(and(eq(reviews.mistakeId, mistakeId), eq(reviews.userId, userId)))
        .orderBy(desc(reviews.createdAt));
    },

    async getDue(userId, opts) {
      // Simple spaced repetition: get unmastered mistakes that haven't been reviewed recently
      // Interval increases with successful reviews:
      // 0 reviews -> due immediately
      // 1 correct -> due after 1 day
      // 2 correct -> due after 3 days
      // 3 correct -> due after 7 days
      // 4+ correct -> due after 14 days

      const now = new Date();

      const conditions = [eq(mistakes.userId, userId), eq(mistakes.mastered, false)];
      if (opts?.subject) conditions.push(eq(mistakes.subject, opts.subject));

      const unmasteredMistakes = await db.select().from(mistakes)
        .where(and(...conditions));

      const results: Array<{
        id: string;
        subject: string;
        topic: string | null;
        problemText: string;
        difficulty: number;
        reviewCount: number;
        lastReviewAt: string | null;
        isDue: boolean;
      }> = [];

      for (const m of unmasteredMistakes) {
        const mistakeReviews = await db.select().from(reviews)
          .where(and(eq(reviews.mistakeId, m.id), eq(reviews.userId, userId)))
          .orderBy(desc(reviews.createdAt));

        const correctCount = mistakeReviews.filter(r => r.result === "correct").length;
        const lastReview = mistakeReviews[0];
        const lastReviewAt = lastReview?.createdAt ?? null;

        // Calculate if due
        let isDue = true;
        if (lastReviewAt) {
          const intervals = [0, 1, 3, 7, 14]; // days
          const intervalDays = intervals[Math.min(correctCount, intervals.length - 1)];
          const nextDue = new Date(lastReviewAt);
          nextDue.setDate(nextDue.getDate() + intervalDays);
          isDue = now >= nextDue;
        }

        if (isDue) {
          results.push({
            id: m.id,
            subject: m.subject,
            topic: m.topic,
            problemText: m.problemText,
            difficulty: m.difficulty,
            reviewCount: mistakeReviews.length,
            lastReviewAt,
            isDue: true,
          });
        }
      }

      // Sort: never reviewed first, then by last review date (oldest first)
      results.sort((a, b) => {
        if (!a.lastReviewAt && b.lastReviewAt) return -1;
        if (a.lastReviewAt && !b.lastReviewAt) return 1;
        if (a.lastReviewAt && b.lastReviewAt) {
          return new Date(a.lastReviewAt).getTime() - new Date(b.lastReviewAt).getTime();
        }
        return 0;
      });

      const limit = opts?.limit ?? 10;
      return results.slice(0, limit).map(({ isDue, ...rest }) => rest);
    },
  };
}
