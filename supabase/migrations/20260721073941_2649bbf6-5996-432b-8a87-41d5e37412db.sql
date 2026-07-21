
CREATE POLICY "block all" ON public.app_admin_config AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "block all" ON public.app_devices AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "block all" ON public.app_pending_approvals AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
