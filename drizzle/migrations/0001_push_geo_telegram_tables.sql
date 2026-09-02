CREATE TABLE public.location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.app_devices(id) ON DELETE CASCADE,
  place text NOT NULL,
  lat double precision,
  lng double precision,
  arrived_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.location_events TO service_role;
ALTER TABLE public.location_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block all" ON public.location_events AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX location_events_device_idx ON public.location_events(device_id, arrived_at DESC);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.app_devices(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used timestamptz
);
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block all" ON public.push_subscriptions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.device_schedules (
  device_id uuid PRIMARY KEY REFERENCES public.app_devices(id) ON DELETE CASCADE,
  day date NOT NULL,
  tz_offset integer NOT NULL DEFAULT 300,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  telegram_on boolean NOT NULL DEFAULT true,
  push_on boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.device_schedules TO service_role;
ALTER TABLE public.device_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block all" ON public.device_schedules AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.device_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.app_devices(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  action text NOT NULL,
  source text NOT NULL DEFAULT 'telegram',
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.device_inbox TO service_role;
ALTER TABLE public.device_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block all" ON public.device_inbox AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX device_inbox_pending_idx ON public.device_inbox(device_id, consumed, created_at);

CREATE TABLE public.telegram_state (
  chat_id text PRIMARY KEY,
  last_task_id text,
  last_task_name text,
  last_device_id uuid,
  asked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_state TO service_role;
ALTER TABLE public.telegram_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block all" ON public.telegram_state AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);