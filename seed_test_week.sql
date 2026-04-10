-- =============================================================
-- WIGGLE TEST DATA SEED — Week of Mar 30 – Apr 3, 2026
-- Groups 91, 92, 93 per day × 5 days = 15 walk_groups rows
-- Mixed walker_notes states for visual testing
--
-- Run in Supabase SQL Editor.
-- Cleanup: run cleanup_test_week.sql
-- =============================================================

DO $$
DECLARE
  dog_ids   uuid[];
  dog_names text[];
  dog_total int;

  walker_ids   uuid[];
  walker_names text[];

  day_dates date[] := ARRAY['2026-03-30','2026-03-31','2026-04-01','2026-04-02','2026-04-03'];
  group_nums int[] := ARRAY[91, 92, 93];
  group_labels text[] := ARRAY['Test Morning', 'Test Midday', 'Test Afternoon'];

  d       date;
  g       int;
  g_label text;
  g_idx   int;   -- 0, 1, 2
  d_idx   int;   -- 0..4
  base    int;   -- offset into dog arrays
  slot    int;   -- 0..5 within group
  grp_dog_ids uuid[];
  did     uuid;
  dname   text;
  wid     uuid;
  wname   text;
BEGIN
  -- ── Load Plateau dogs (ordered, deterministic) ──────────────
  SELECT array_agg(id ORDER BY dog_name),
         array_agg(dog_name ORDER BY dog_name)
    INTO dog_ids, dog_names
    FROM dogs
   WHERE sector = 'Plateau';

  dog_total := array_length(dog_ids, 1);

  IF dog_total IS NULL OR dog_total < 6 THEN
    RAISE EXCEPTION 'Need at least 6 Plateau dogs, found %', COALESCE(dog_total, 0);
  END IF;

  -- ── Load up to 3 real Plateau walkers ──────────────────────
  SELECT array_agg(id ORDER BY full_name),
         array_agg(full_name ORDER BY full_name)
    INTO walker_ids, walker_names
    FROM (
      SELECT id, full_name
        FROM profiles
       WHERE role IN ('senior_walker', 'junior_walker')
         AND (sector = 'Plateau' OR sector = 'both')
         AND full_name NOT IN ('Wiggle Pro', 'Pup Walker')
         AND email != 'test@wiggledogwalks.com'
       ORDER BY full_name
       LIMIT 3
    ) sub;

  IF array_length(walker_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No eligible Plateau walkers found in profiles';
  END IF;

  -- ── Loop: 5 days × 3 groups ────────────────────────────────
  FOR d_idx IN 0..4 LOOP
    d := day_dates[d_idx + 1];

    FOR g_idx IN 0..2 LOOP
      g       := group_nums[g_idx + 1];
      g_label := group_labels[g_idx + 1];

      -- Pick walker for this group (rotate through available walkers)
      wid   := walker_ids[(g_idx % array_length(walker_ids, 1)) + 1];
      wname := walker_names[(g_idx % array_length(walker_names, 1)) + 1];

      -- Pick 6 dogs, offset by day and group to get variety
      base := (d_idx * 18 + g_idx * 6) % dog_total;
      grp_dog_ids := ARRAY[]::uuid[];

      FOR slot IN 0..5 LOOP
        grp_dog_ids := grp_dog_ids || dog_ids[((base + slot) % dog_total) + 1];
      END LOOP;

      -- ── Insert walk_groups row ──────────────────────────────
      INSERT INTO walk_groups (walk_date, group_num, group_name, dog_ids, walker_ids, walker_id, sector, locked)
      VALUES (d, g, g_label, grp_dog_ids, ARRAY[wid], wid, 'Plateau', false)
      ON CONFLICT (walk_date, group_num, sector) DO UPDATE
        SET dog_ids    = EXCLUDED.dog_ids,
            walker_ids = EXCLUDED.walker_ids,
            walker_id  = EXCLUDED.walker_id,
            group_name = EXCLUDED.group_name;

      -- ── Insert walker_notes per dog state ───────────────────
      -- slot 0,1 = picked up (pickup only)
      -- slot 2   = returned  (pickup + returned)
      -- slot 3   = not walking
      -- slot 4,5 = waiting   (no rows)

      FOR slot IN 0..3 LOOP
        did   := grp_dog_ids[slot + 1];
        dname := dog_names[((base + slot) % dog_total) + 1];

        IF slot IN (0, 1, 2) THEN
          -- pickup
          INSERT INTO walker_notes (dog_id, dog_name, walker_id, walker_name, note_type, walk_date, group_num, created_at)
          VALUES (did, dname, wid, wname, 'pickup', d,  g,
                  (d + TIME '09:30:00' + (slot * INTERVAL '8 minutes'))::timestamptz);
        END IF;

        IF slot = 2 THEN
          -- returned
          INSERT INTO walker_notes (dog_id, dog_name, walker_id, walker_name, note_type, walk_date, group_num, created_at)
          VALUES (did, dname, wid, wname, 'returned', d, g,
                  (d + TIME '10:45:00')::timestamptz);
        END IF;

        IF slot = 3 THEN
          -- not walking
          INSERT INTO walker_notes (dog_id, dog_name, walker_id, walker_name, note_type, message, walk_date, group_num)
          VALUES (did, dname, wid, wname, 'not_walking', 'Not walking today', d, g);
        END IF;
      END LOOP;

    END LOOP; -- groups
  END LOOP; -- days

  RAISE NOTICE 'Seeded 15 walk_groups (91/92/93 × 5 days) + walker_notes for mixed states';
END $$;
