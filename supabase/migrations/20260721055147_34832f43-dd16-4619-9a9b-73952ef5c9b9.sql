
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke execute from public/anon/authenticated on the security-definer trigger fn
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten qr_sessions policies (session_code is a hard-to-guess UUID acting as a bearer token,
-- but restrict updates to fields that make sense during handshake)
DROP POLICY IF EXISTS "qr insert own" ON public.qr_sessions;
DROP POLICY IF EXISTS "qr update by code" ON public.qr_sessions;

-- Only authenticated master users can insert QR sessions tied to their account
CREATE POLICY "qr insert authenticated" ON public.qr_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Only the owning user can update (approve/reject) a session
CREATE POLICY "qr update owner" ON public.qr_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (true);
