CREATE POLICY "walk_groups_admin_select_all" ON walk_groups
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
