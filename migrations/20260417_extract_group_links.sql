-- Migration: extract group_links schema
-- Extracted from live Supabase (ifhniwjdrsswgemmqddn) on 2026-04-17
-- Purpose: reproducible DB definition for wiggle-world HQ port
-- This migration is idempotent (IF NOT EXISTS everywhere)
--
-- Replica identity: DEFAULT (relreplident = 'd'). NOT in supabase_realtime
-- publication today.

CREATE TABLE IF NOT EXISTS public.group_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_a_key   text        NOT NULL,
  group_b_key   text        NOT NULL,
  walk_date     date        NULL DEFAULT CURRENT_DATE,
  sector        text        NOT NULL,
  created_at   timestamptz  NULL DEFAULT now(),
  sync_position integer     NULL
);

-- RLS
ALTER TABLE public.group_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_crud_group_links" ON public.group_links;

CREATE POLICY "auth_crud_group_links"
  ON public.group_links
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
