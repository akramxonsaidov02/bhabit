ALTER TABLE public.device_schedules
  ADD COLUMN IF NOT EXISTS day_start text NOT NULL DEFAULT '06:30',
  ADD COLUMN IF NOT EXISTS sleep_time text NOT NULL DEFAULT '22:30';
ALTER TABLE public.location_events
  ADD COLUMN IF NOT EXISTS task_id text,
  ADD COLUMN IF NOT EXISTS task_name text;