-- Mini Gen staging table — draft groups before promotion to walk_groups
CREATE TABLE IF NOT EXISTS mini_gen_drafts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date    date        NOT NULL,
  walk_date   date        NOT NULL,
  sector      text        NOT NULL CHECK (sector IN ('Plateau', 'Laurier')),
  dog_names   text[]      NOT NULL DEFAULT '{}',
  dog_uuids   uuid[]      NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  flags       jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mini_gen_drafts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For Tower Control reads:
CREATE POLICY "Authenticated users can read drafts"
  ON mini_gen_drafts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage drafts"
  ON mini_gen_drafts FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX ON mini_gen_drafts (walk_date, sector);
CREATE INDEX ON mini_gen_drafts (status);
