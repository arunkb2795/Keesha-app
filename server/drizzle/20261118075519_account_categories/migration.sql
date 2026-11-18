CREATE TABLE "expense_categories" (
	"id" text PRIMARY KEY,
	"owner_id" uuid,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_length" CHECK (char_length(btrim("name")) between 1 and
    case when "owner_id" is null then 200 else 12 end),
	CONSTRAINT "expense_categories_icon" CHECK ("icon" in ('food', 'grocery', 'transport', 'shopping', 'bills', 'medical', 'entertainment', 'travel', 'education', 'other', 'home', 'person', 'fitness', 'gift', 'work', 'pet'))
);
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_category_id_categories_id_fkey";--> statement-breakpoint
-- Preserve every existing category ID so previously saved expenses keep their category.
INSERT INTO "expense_categories" ("id", "name", "icon")
SELECT "id", "name", "id" FROM "categories"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_owner_name_idx" ON "expense_categories" ("owner_id",lower(btrim("name"))) WHERE "owner_id" is not null;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_owner_id_app_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id");
--> statement-breakpoint
-- Carry forward access only for existing application roles that already read categories
-- and insert expenses. No access is granted to PUBLIC.
DO $$
DECLARE app_role record;
BEGIN
  FOR app_role IN
    SELECT DISTINCT c.grantee FROM information_schema.role_table_grants c
    JOIN information_schema.role_table_grants e ON e.grantee = c.grantee
    WHERE c.table_schema = current_schema() AND c.table_name = 'categories' AND c.privilege_type = 'SELECT'
      AND e.table_schema = current_schema() AND e.table_name = 'expenses' AND e.privilege_type = 'INSERT'
      AND c.grantee <> current_user AND c.grantee <> 'PUBLIC'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT ON TABLE expense_categories TO %I', app_role.grantee);
  END LOOP;
END $$;
