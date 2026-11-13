-- B2: the agency's scheduling defaults on its one org_shift_behavior_settings
-- row (Settings › Rules, Pay, Open shifts, Notifications). Each column is one
-- control on that screen; ot_threshold_hours and rule_settings already exist.
ALTER TABLE public.org_shift_behavior_settings
  ADD COLUMN hours_cap integer NOT NULL DEFAULT 50 CHECK (hours_cap BETWEEN 1 AND 168),        -- agency hours cap a week (Decision 10)
  ADD COLUMN min_rest_hours integer NOT NULL DEFAULT 8 CHECK (min_rest_hours BETWEEN 0 AND 24), -- rest between shifts
  ADD COLUMN max_days_in_row integer NOT NULL DEFAULT 6 CHECK (max_days_in_row BETWEEN 1 AND 14),
  ADD COLUMN max_hours_in_row integer NOT NULL DEFAULT 16 CHECK (max_hours_in_row BETWEEN 1 AND 48),
  ADD COLUMN claim_mode text NOT NULL DEFAULT 'first' CHECK (claim_mode IN ('first', 'approve')), -- who gets an open shift (Decision 6)
  ADD COLUMN quiet_start smallint NOT NULL DEFAULT 21 CHECK (quiet_start BETWEEN 0 AND 23),     -- no offers from this hour...
  ADD COLUMN quiet_end smallint NOT NULL DEFAULT 7 CHECK (quiet_end BETWEEN 0 AND 23),          -- ...to this hour
  ADD COLUMN urgent_hours smallint NOT NULL DEFAULT 4 CHECK (urgent_hours BETWEEN 1 AND 24),    -- starts within → urgent, ignores quiet hours
  ADD COLUMN escalation_waits smallint[] NOT NULL DEFAULT '{15,15,10}',                         -- minutes at lead, on-call, owner (Decision 7)
  ADD COLUMN holdover_ask boolean NOT NULL DEFAULT true,                                        -- ask someone on shift to stay
  ADD COLUMN holdover_visible boolean NOT NULL DEFAULT true,                                    -- staff can see the hold-over list
  ADD COLUMN workweek_start smallint NOT NULL DEFAULT 0 CHECK (workweek_start IN (0, 1)),       -- 0 Sunday, 1 Monday (overtime week)
  ADD COLUMN ot_multiplier numeric NOT NULL DEFAULT 1.5 CHECK (ot_multiplier >= 1),
  ADD COLUMN sleep_rate numeric NOT NULL DEFAULT 12 CHECK (sleep_rate >= 0),                    -- $/h for asleep hours where a home pays a sleep rate
  ADD COLUMN oncall_stipend numeric NOT NULL DEFAULT 40 CHECK (oncall_stipend >= 0),
  ADD COLUMN night_diff numeric CHECK (night_diff IS NULL OR night_diff > 0),                   -- $/h extra at night; null = off
  ADD COLUMN night_from smallint NOT NULL DEFAULT 23 CHECK (night_from BETWEEN 0 AND 23),
  ADD COLUMN night_to smallint NOT NULL DEFAULT 7 CHECK (night_to BETWEEN 0 AND 23),
  ADD COLUMN weekend_diff numeric CHECK (weekend_diff IS NULL OR weekend_diff > 0),             -- $/h extra Sat/Sun; null = off
  ADD COLUMN reminder_minutes smallint NOT NULL DEFAULT 60 CHECK (reminder_minutes >= 0),       -- 0 = no shift reminder
  ADD COLUMN digest boolean NOT NULL DEFAULT true,                                              -- batch non-urgent changes into one notice
  ADD COLUMN location_at_punch_only boolean NOT NULL DEFAULT true;
