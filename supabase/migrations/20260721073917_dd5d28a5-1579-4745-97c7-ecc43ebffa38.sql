
-- Device-based auth for the single-owner site
CREATE TABLE IF NOT EXISTS public.app_admin_config (
  id INT PRIMARY KEY DEFAULT 1,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT ALL ON public.app_admin_config TO service_role;
ALTER TABLE public.app_admin_config ENABLE ROW LEVEL SECURITY;

-- Seed default master PIN (sha256 of user's chosen master code)
INSERT INTO public.app_admin_config (id, pin_hash)
VALUES (1, '3951e7960e62f101c49d153ab8e3df040aced10e58124ddd09f741a3701e7f15')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.app_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT,
  user_agent TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','sub_admin','user','viewer')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.app_devices(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS app_devices_role_idx ON public.app_devices(role);
GRANT ALL ON public.app_devices TO service_role;
ALTER TABLE public.app_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  approved_role TEXT,
  approved_permissions JSONB,
  approved_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);
CREATE INDEX IF NOT EXISTS app_pending_qr_idx ON public.app_pending_approvals(qr_code);
GRANT ALL ON public.app_pending_approvals TO service_role;
ALTER TABLE public.app_pending_approvals ENABLE ROW LEVEL SECURITY;

-- Realtime for force-logout & auto-approval polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_pending_approvals;
ALTER TABLE public.app_devices REPLICA IDENTITY FULL;
ALTER TABLE public.app_pending_approvals REPLICA IDENTITY FULL;
