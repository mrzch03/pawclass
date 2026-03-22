import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const mistakes = pgTable("mistakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic"),
  problemText: text("problem_text").notNull(),
  problemImageUrl: text("problem_image_url"),
  wrongAnswer: text("wrong_answer"),
  correctAnswer: text("correct_answer"),
  explanation: text("explanation"),
  difficulty: integer("difficulty").default(3).notNull(),
  source: text("source"),
  tags: text("tags"), // JSON array as string: '["tag1","tag2"]'
  mastered: boolean("mastered").default(false).notNull(),
  masteredAt: timestamp("mastered_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  mistakeId: uuid("mistake_id").notNull().references(() => mistakes.id),
  result: text("result").notNull(), // "correct" | "wrong" | "partial"
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  currentStepIndex: integer("current_step_index").notNull().default(0),
  scenes: jsonb("scenes").notNull().default([]),
  quizResults: jsonb("quiz_results").notNull().default([]),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { mode: "string" }),
  completedAt: timestamp("completed_at", { mode: "string" }),
});

export type Mistake = typeof mistakes.$inferSelect;
export type NewMistake = typeof mistakes.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type CourseRow = typeof courses.$inferSelect;
