-- Existing expense writers may edit only the fields used by the transaction editor.
-- Keep identity, ownership, creation time, notes and deletion permissions unchanged.
DO $$
DECLARE app_role record;
BEGIN
  FOR app_role IN
    SELECT DISTINCT reads.grantee
    FROM information_schema.role_table_grants reads
    JOIN information_schema.role_table_grants writes ON writes.grantee = reads.grantee
    WHERE reads.table_schema = current_schema() AND reads.table_name = 'expenses'
      AND reads.privilege_type = 'SELECT'
      AND writes.table_schema = current_schema() AND writes.table_name = 'expenses'
      AND writes.privilege_type = 'INSERT'
      AND reads.grantee <> current_user AND reads.grantee <> 'PUBLIC'
  LOOP
    EXECUTE format('GRANT UPDATE (title, amount_paise, category_id, expense_date, version, updated_at) ON TABLE expenses TO %I', app_role.grantee);
  END LOOP;
END $$;
