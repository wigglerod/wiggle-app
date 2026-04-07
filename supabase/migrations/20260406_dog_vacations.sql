-- Dog vacations: explicit vacation blocks for Mini Gen and Tower
CREATE TABLE IF NOT EXISTS public.dog_vacations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id       uuid REFERENCES public.dogs(id) ON DELETE CASCADE,
  dog_name     text NOT NULL,
  sector       text NOT NULL CHECK (sector IN ('Plateau', 'Laurier')),
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  reason       text,
  source       text DEFAULT 'manual'
               CHECK (source IN ('manual', 'acuity', 'email', 'sms', 'instagram', 'beast')),
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Index for Mini Gen: is this dog on vacation on date X?
CREATE INDEX IF NOT EXISTS dog_vacations_dog_dates_idx
  ON public.dog_vacations (dog_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS dog_vacations_dates_idx
  ON public.dog_vacations (start_date, end_date);

-- RLS
ALTER TABLE public.dog_vacations ENABLE ROW LEVEL SECURITY;

-- Walkers and admins can read all vacation blocks
CREATE POLICY "authenticated_read_vacations"
  ON public.dog_vacations FOR SELECT
  TO authenticated
  USING (true);

-- Admins can write (Beast executor uses service role)
CREATE POLICY "admin_write_vacations"
  ON public.dog_vacations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role full access (Beast executor)
CREATE POLICY "service_role_all_vacations"
  ON public.dog_vacations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
