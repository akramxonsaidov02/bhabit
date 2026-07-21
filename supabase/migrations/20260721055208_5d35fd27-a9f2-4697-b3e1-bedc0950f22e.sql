
DROP POLICY IF EXISTS "qr update owner" ON public.qr_sessions;
CREATE POLICY "qr update owner" ON public.qr_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
