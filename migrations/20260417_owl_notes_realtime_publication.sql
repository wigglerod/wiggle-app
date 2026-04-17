-- Migration: add owl_notes to supabase_realtime publication
-- Date: 2026-04-17
--
-- Context: useOwlNotes.js subscribes to postgres_changes on public.owl_notes
-- from Dashboard, Header owl-count, OwlQuickDrawer, DogProfileDrawer, and
-- OwlNotesTab, but the table was never added to the supabase_realtime
-- publication — so those subscriptions never receive events.
--
-- REPLICA IDENTITY FULL is required alongside the publication add: without it
-- DELETE events only carry the PK, and client handlers that key off
-- target_dog_id / target_sector would silently break (same bug class that hit
-- walker_notes on 2026-04-15).

ALTER PUBLICATION supabase_realtime ADD TABLE public.owl_notes;
ALTER TABLE public.owl_notes REPLICA IDENTITY FULL;
