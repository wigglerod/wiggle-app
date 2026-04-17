-- Migration: extract flag_cards schema
-- Extracted from live Supabase (ifhniwjdrsswgemmqddn) on 2026-04-17
-- Purpose: reproducible DB definition for wiggle-world HQ port
-- This migration is idempotent (IF NOT EXISTS everywhere)
--
-- Replica identity: DEFAULT (relreplident = 'd'). NOT in supabase_realtime
-- publication today. If added later, flip to REPLICA IDENTITY FULL first.
-- Flagged in report.

CREATE TABLE IF NOT EXISTS public.flag_cards (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text        NOT NULL,
  source_id         text        NULL,
  source_thread_id  text        NULL,
  dog_name          text        NULL,
  dog_id            uuid        NULL,
  owner_name        text        NULL,
  owner_email       text        NULL,
  category          text        NULL,
  summary           text        NULL,
  raw_excerpt       text        NULL,
  walk_date         date        NULL,
  status            text        NOT NULL DEFAULT 'open',
  actioned_by       uuid        NULL,
  actioned_by_name  text        NULL,
  actioned_at       timestamptz NULL,
  action_taken      text        NULL,
  priority          text        NULL DEFAULT 'normal',
  created_at        timestamptz NOT NULL DEFAULT now(),
  scout_run_date    date        NULL DEFAULT CURRENT_DATE,
  thread_messages   jsonb       NULL,
  CONSTRAINT flag_cards_actioned_by_fkey FOREIGN KEY (actioned_by) REFERENCES public.profiles (id),
  CONSTRAINT flag_cards_dog_id_fkey      FOREIGN KEY (dog_id)      REFERENCES public.dogs (id),
  -- Unique (source, source_id) also enforced by flag_cards_source_source_id_key
  CONSTRAINT flag_cards_source_source_id_key UNIQUE (source, source_id)
);

-- Partial unique dedup index (only when source_id is present)
CREATE UNIQUE INDEX IF NOT EXISTS flag_cards_dedup
  ON public.flag_cards USING btree (source, source_id)
  WHERE (source_id IS NOT NULL);

-- Lookup by dog (only rows that have a dog_name)
CREATE INDEX IF NOT EXISTS flag_cards_dog
  ON public.flag_cards USING btree (dog_name)
  WHERE (dog_name IS NOT NULL);

-- Queue view: open cards, newest first
CREATE INDEX IF NOT EXISTS flag_cards_open
  ON public.flag_cards USING btree (status, created_at DESC)
  WHERE (status = 'open'::text);

-- RLS
ALTER TABLE public.flag_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage flag_cards" ON public.flag_cards;

CREATE POLICY "Admins can manage flag_cards"
  ON public.flag_cards
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
