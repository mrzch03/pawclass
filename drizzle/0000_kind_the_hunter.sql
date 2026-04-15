CREATE TABLE IF NOT EXISTS "concept_mastery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"course_id" text NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"wrong_count" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"mastery_level" text DEFAULT 'new' NOT NULL,
	"last_practiced" timestamp,
	"next_review_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"scenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quiz_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"plan_date" date NOT NULL,
	"tasks" jsonb NOT NULL,
	"total_minutes" integer,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"course_id" text NOT NULL,
	"session_id" text,
	"is_correct" boolean NOT NULL,
	"student_answer" text,
	"time_spent_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mistakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text,
	"problem_text" text NOT NULL,
	"problem_image_url" text,
	"wrong_answer" text,
	"correct_answer" text,
	"explanation" text,
	"difficulty" integer DEFAULT 3 NOT NULL,
	"source" text,
	"tags" text,
	"mastered" boolean DEFAULT false NOT NULL,
	"mastered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"mode" text NOT NULL,
	"config" jsonb,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mistake_id" uuid NOT NULL,
	"result" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_mistake_id_mistakes_id_fk" FOREIGN KEY ("mistake_id") REFERENCES "public"."mistakes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "concept_mastery_unique" ON "concept_mastery" USING btree ("user_id","concept_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_plans_unique" ON "daily_plans" USING btree ("user_id","course_id","plan_date");