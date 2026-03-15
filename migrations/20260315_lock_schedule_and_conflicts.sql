-- Feature 1: Lock schedule
ALTER TABLE walk_groups ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;

-- Feature 2: Dog conflicts table
CREATE TABLE IF NOT EXISTS dog_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_1_name text NOT NULL,
  dog_2_name text NOT NULL,
  reason text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dog_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read conflicts"
  ON dog_conflicts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage conflicts"
  ON dog_conflicts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed
INSERT INTO dog_conflicts (dog_1_name, dog_2_name, reason)
VALUES ('Mochi', 'Chaska', 'Do not group together');
