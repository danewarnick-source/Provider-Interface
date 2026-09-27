-- DB-17 (Lane A). Applied live as version 20260927033830. Owner decision D12: Dane 9:34 PM MT Sep 26 2026
-- ("only admins/managers may insert or update certification records; no self-issue").
-- Fixes: staff could self-issue a certifications row (WITH CHECK allowed user_id = auth.uid()).
-- UPDATE ("org admins manage certs") was already is_org_admin_or_manager only; unchanged. DELETE unchanged.
-- Callers: no src/edge code inserts into public.certifications (reads only: audit-packet, employee-face-sheet,
--   auditor-shares). Table had 0 rows.
-- Prior WITH CHECK:
--   ((user_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()))
ALTER POLICY "system issues cert" ON public.certifications WITH CHECK (public.is_org_admin_or_manager(organization_id, auth.uid()));
