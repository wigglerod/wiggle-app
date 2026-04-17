-- Migration: extract walker_notes schema
-- Extracted from live Supabase (ifhniwjdrsswgemmqddn) on 2026-04-17
-- Purpose: reproducible DB definition for wiggle-world HQ port
-- This migration is idempotent (IF NOT EXISTS everywhere)
--
-- Replica identity: FULL (relreplident = 'f') — supports DELETE events in realtime.
-- Realtime publication: walker_notes IS a member of supabase_realtime.

CREATE TABLE IF NOT EXISTS public.walker_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id      uuid        NULL,
  dog_name    text        NOT NULL,
  walker_id   uuid        NOT NULL,
  walker_name text        NOT NULL,
  note_type   text        NOT NULL,
  tags        text[]      NULL,
  message     text        NULL,
  walk_date   date        NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NULL DEFAULT now(),
  group_num   integer     NULL,
  CONSTRAINT walker_notes_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES public.dogs (id)
);

-- Enforce one pickup/returned/not_walking row per dog per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_walker_notes_one_state_per_dog_day
  ON public.walker_notes USING btree (dog_id, walk_date, note_type)
  WHERE (note_type = ANY (ARRAY['pickup'::text, 'returned'::text, 'not_walking'::text]));

-- RLS
ALTER TABLE public.walker_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read walker_notes"   ON public.walker_notes;
DROP POLICY IF EXISTS "Authenticated can insert walker_notes" ON public.walker_notes;
DROP POLICY IF EXISTS "Authenticated can delete own walker_notes" ON public.walker_notes;
DROP POLICY IF EXISTS "Admins can update walker_notes"        ON public.walker_notes;

CREATE POLICY "Authenticated can read walker_notes"
  ON public.walker_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert walker_notes"
  ON public.walker_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete own walker_notes"
  ON public.walker_notes
  FOR DELETE
  TO authenticated
  USING (walker_id = auth.uid());

CREATE POLICY "Admins can update walker_notes"
  ON public.walker_notes
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Realtime: this table is already in supabase_realtime publication (added in
-- an earlier manual step). Re-adding would error, so this migration does not
-- include an ALTER PUBLICATION statement. See SCHEMA_EXTRACTION_REPORT.md.

-- Ensure DELETE events carry full row data (matches current live state)
ALTER TABLE public.walker_notes REPLICA IDENTITY FULL;
