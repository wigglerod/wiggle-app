-- Acuity notes: owner-written notes from booking, expire on booking_date
CREATE TABLE IF NOT EXISTS public.acuity_notes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id                uuid REFERENCES public.dogs(id) ON DELETE CASCADE,
  dog_name              text NOT NULL,
  sector                text NOT NULL CHECK (sector IN ('Plateau', 'Laurier')),
  note_text             text NOT NULL,
  acuity_appointment_id text,
  booking_date          date NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Index for the most common query: today's notes by dog
CREATE INDEX IF NOT EXISTS acuity_notes_dog_date_idx
  ON public.acuity_notes (dog_id, booking_date);

CREATE INDEX IF NOT EXISTS acuity_notes_date_idx
  ON public.acuity_notes (booking_date);

-- RLS
ALTER TABLE public.acuity_notes ENABLE ROW LEVEL SECURITY;

-- Walkers can read notes for today only
CREATE POLICY "walkers_read_today_acuity_notes"
  ON public.acuity_notes FOR SELECT
  USING (booking_date = CURRENT_DATE);

-- Service role writes (Acuity webhook, Beast executor)
CREATE POLICY "service_role_all_acuity_notes"
  ON public.acuity_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
