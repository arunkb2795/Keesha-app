CREATE TYPE "account_status" AS ENUM('active', 'deletion_pending', 'deleted');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"clerk_user_id" text NOT NULL UNIQUE,
	"name" text,
	"email" text NOT NULL,
	"status" "account_status" DEFAULT 'active'::"account_status" NOT NULL,
	"sync_revision" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY,
	"owner_id" uuid NOT NULL,
	"category_id" text DEFAULT 'other' NOT NULL,
	"title" text,
	"amount_paise" bigint NOT NULL,
	"expense_date" date NOT NULL,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expenses_amount_range" CHECK ("amount_paise" between 1 and 999999999),
	CONSTRAINT "expenses_note_length" CHECK (char_length("note") between 1 and 200),
	CONSTRAINT "expenses_title_length" CHECK (char_length(btrim("title")) between 1 and 200),
	CONSTRAINT "expenses_positive_version" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "mutation_receipts" (
	"owner_id" uuid,
	"mutation_id" uuid,
	"request_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mutation_receipts_pkey" PRIMARY KEY("owner_id","mutation_id")
);
--> statement-breakpoint
CREATE TABLE "sync_changes" (
	"owner_id" uuid,
	"revision" bigint,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_changes_pkey" PRIMARY KEY("owner_id","revision")
);
--> statement-breakpoint
CREATE INDEX "expenses_owner_idx" ON "expenses" ("owner_id");--> statement-breakpoint
CREATE INDEX "expenses_active_history_idx" ON "expenses" ("owner_id","expense_date" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "expenses_active_category_history_idx" ON "expenses" ("owner_id","category_id","expense_date" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_owner_id_app_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_owner_id_app_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_changes" ADD CONSTRAINT "sync_changes_owner_id_app_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE;