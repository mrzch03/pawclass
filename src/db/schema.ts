import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, date, uniqueIndex } from "drizzle-orm/pg-core";

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

// --- 学习系统新增表 ---

export const conceptMastery = pgTable("concept_mastery", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  conceptId: text("concept_id").notNull(),
  courseId: text("course_id").notNull(),         // e.g. "middle/grade7-up/english"
  totalAttempts: integer("total_attempts").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  wrongCount: integer("wrong_count").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  masteryLevel: text("mastery_level").notNull().default("new"), // 'new' | 'learning' | 'practiced' | 'mastered'
  lastPracticed: timestamp("last_practiced", { mode: "string" }),
  nextReviewAt: timestamp("next_review_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("concept_mastery_unique").on(table.userId, table.conceptId, table.courseId),
]);

export const exerciseAttempts = pgTable("exercise_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  conceptId: text("concept_id").notNull(),
  courseId: text("course_id").notNull(),
  sessionId: text("session_id"),
  isCorrect: boolean("is_correct").notNull(),
  studentAnswer: text("student_answer"),
  timeSpentMs: integer("time_spent_ms"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

export const practiceSessions = pgTable("practice_sessions", {
  id: text("id").primaryKey(),                   // "prs_" + nanoid
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'abandoned'
  mode: text("mode").notNull(),                  // 'review' | 'practice' | 'diagnosis' | 'daily_plan'
  config: jsonb("config"),                       // { concepts, difficulty, exerciseCount }
  exercises: jsonb("exercises").notNull().default([]), // [{ exerciseId, conceptId, status, result }]
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  startedAt: timestamp("started_at", { mode: "string" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: "string" }),
});

export const dailyPlans = pgTable("daily_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull(),
  planDate: date("plan_date").notNull(),
  tasks: jsonb("tasks").notNull(),               // [{ type, conceptIds, mode, count, minutes, status }]
  totalMinutes: integer("total_minutes"),
  completedCount: integer("completed_count").notNull().default(0),
  source: text("source").notNull().default("auto"), // 'auto' | 'agent'
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("daily_plans_unique").on(table.userId, table.courseId, table.planDate),
]);

// --- 教学指令表 ---

export const teachingDirectives = pgTable("teaching_directives", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: text("teacher_id").notNull(),
  studentId: text("student_id").notNull(),
  courseId: text("course_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'executing' | 'done' | 'dismissed'
  agentNote: text("agent_note"),
  resultRefs: jsonb("result_refs"),  // { planId, practiceIds }
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: "string" }),
});

// --- 类型导出 ---

export type Mistake = typeof mistakes.$inferSelect;
export type NewMistake = typeof mistakes.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type CourseRow = typeof courses.$inferSelect;
export type ConceptMastery = typeof conceptMastery.$inferSelect;
export type ExerciseAttempt = typeof exerciseAttempts.$inferSelect;
export type PracticeSession = typeof practiceSessions.$inferSelect;
export type DailyPlan = typeof dailyPlans.$inferSelect;
export type TeachingDirective = typeof teachingDirectives.$inferSelect;
