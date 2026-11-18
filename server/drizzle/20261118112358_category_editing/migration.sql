CREATE TABLE "category_preferences" (
	"owner_id" uuid,
	"category_id" text,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	CONSTRAINT "category_preferences_pkey" PRIMARY KEY("owner_id","category_id"),
	CONSTRAINT "category_preferences_name_length" CHECK (char_length(btrim("name")) between 1 and 200),
	CONSTRAINT "category_preferences_icon" CHECK ("icon" in ('food', 'grocery', 'transport', 'shopping', 'bills', 'medical', 'entertainment', 'travel', 'education', 'other', 'home', 'person', 'fitness', 'gift', 'work', 'pet', 'coffee', 'car', 'bicycle', 'fuel', 'parking', 'bank', 'savings', 'phone', 'internet', 'music', 'game', 'beauty', 'clothing', 'baby', 'plants', 'tools'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "category_preferences_owner_name_idx" ON "category_preferences" ("owner_id",lower(btrim("name")));--> statement-breakpoint
ALTER TABLE "category_preferences" ADD CONSTRAINT "category_preferences_owner_id_app_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_preferences" ADD CONSTRAINT "category_preferences_category_id_expense_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Extend existing category-writer roles only to the fields needed by category editing.
DO $$
DECLARE app_role record;
BEGIN
  FOR app_role IN
    SELECT DISTINCT reads.grantee FROM information_schema.role_table_grants reads
    JOIN information_schema.role_table_grants writes ON writes.grantee = reads.grantee
    WHERE reads.table_schema = current_schema() AND reads.table_name = 'expense_categories'
      AND reads.privilege_type = 'SELECT'
      AND writes.table_schema = current_schema() AND writes.table_name = 'expense_categories'
      AND writes.privilege_type = 'INSERT'
      AND reads.grantee <> current_user AND reads.grantee <> 'PUBLIC'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT ON TABLE category_preferences TO %I', app_role.grantee);
    EXECUTE format('GRANT UPDATE (name, icon) ON TABLE category_preferences TO %I', app_role.grantee);
    EXECUTE format('GRANT UPDATE (name, icon) ON TABLE expense_categories TO %I', app_role.grantee);
  END LOOP;
END $$;
