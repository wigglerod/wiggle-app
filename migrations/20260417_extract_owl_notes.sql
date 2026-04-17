-- Migration: extract owl_notes schema
-- Extracted from live Supabase (ifhniwjdrsswgemmqddn) on 2026-04-17
-- Purpose: reproducible DB definition for wiggle-world HQ port
-- This migration is idempotent (IF NOT EXISTS everywhere)
--
-- Replica identity: DEFAULT (relreplident = 'd'). NOT in supabase_realtime
-- publication today. If owl_notes is ever added to the publication, also
-- set REPLICA IDENTITY FULL or DELETE events will be silently dropped
-- (same bug class as the walker_notes issue). Flagged in report.

CREATE TABLE IF NOT EXISTS public.owl_notes (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_text                text        NOT NULL,
  target_type              text        NOT NULL,
  target_dog_id            uuid        NULL,
  target_dog_name          text        NULL,
  target_sector            text        NULL,
  created_by               uuid        NULL,
  created_by_name          text        NULL,
  acknowledged_by          uuid        NULL,
  acknowledged_by_name     text        NULL,
  acknowledged_at          timestamptz NULL,
  note_date                date        NOT NULL DEFAULT CURRENT_DATE,
  expires_at               timestamptz NULL,
  created_at               timestamptz NULL DEFAULT now(),
  scheduled_date           date        NULL DEFAULT CURRENT_DATE,
  last_acknowledged_date   date        NULL,
  CONSTRAINT owl_notes_target_dog_id_fkey FOREIGN KEY (target_dog_id) REFERENCES public.dogs (id)
);

-- RLS
ALTER TABLE public.owl_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read owl_notes"   ON public.owl_notes;
DROP POLICY IF EXISTS "Allow anon insert owl_notes" ON public.owl_notes;
DROP POLICY IF EXISTS "owl_notes_select" ON public.owl_notes;
DROP POLICY IF EXISTS "owl_notes_insert" ON public.owl_notes;
DROP POLICY IF EXISTS "owl_notes_update" ON public.owl_notes;
DROP POLICY IF EXISTS "owl_notes_delete" ON public.owl_notes;

-- Anon policies (kept as-is from live state)
CREATE POLICY "Allow anon read owl_notes"
  ON public.owl_notes
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert owl_notes"
  ON public.owl_notes
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated policies
CREATE POLICY "owl_notes_select"
  ON public.owl_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "owl_notes_insert"
  ON public.owl_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin'::text, 'senior_walker'::text])
    )
  );

CREATE POLICY "owl_notes_update"
  ON public.owl_notes
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "owl_notes_delete"
  ON public.owl_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin'::text, 'senior_walker'::text])
    )
  );
