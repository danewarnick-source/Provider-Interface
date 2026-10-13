-- Scheduler S1: day_program_* policies called is_org_admin_or_manager(auth.uid(), org)
-- with the arguments swapped (signature is (_org, _user)), so no write could ever pass.
-- Replaced in place with ALTER POLICY (same policy names).

ALTER POLICY "Admins/managers write sessions" ON public.day_program_sessions
  USING (public.access_can_write_day_program(organization_id, auth.uid()))
  WITH CHECK (public.access_can_write_day_program(organization_id, auth.uid()));

ALTER POLICY "Org members read sessions" ON public.day_program_sessions
  USING (public.is_org_member(organization_id, auth.uid()));

ALTER POLICY "Admins/managers write session staff" ON public.day_program_session_staff
  USING (EXISTS (
    SELECT 1 FROM public.day_program_sessions s
    WHERE s.id = day_program_session_staff.session_id
      AND public.access_can_write_day_program(s.organization_id, auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.day_program_sessions s
    WHERE s.id = day_program_session_staff.session_id
      AND public.access_can_write_day_program(s.organization_id, auth.uid())));

ALTER POLICY "Org members read session staff" ON public.day_program_session_staff
  USING (EXISTS (
    SELECT 1 FROM public.day_program_sessions s
    WHERE s.id = day_program_session_staff.session_id
      AND public.is_org_member(s.organization_id, auth.uid())));

ALTER POLICY "Admins/managers write attendance" ON public.day_program_attendance
  USING (EXISTS (
    SELECT 1 FROM public.day_program_sessions s
    WHERE s.id = day_program_attendance.session_id
      AND public.access_can_write_day_program(s.organization_id, auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.day_program_sessions s
    WHERE s.id = day_program_attendance.session_id
      AND public.access_can_write_day_program(s.organization_id, auth.uid())));

ALTER POLICY "Org members read attendance" ON public.day_program_attendance
  USING (EXISTS (
    SELECT 1 FROM public.day_program_sessions s
    WHERE s.id = day_program_attendance.session_id
      AND public.is_org_member(s.organization_id, auth.uid())));

ALTER POLICY "Admins/managers write transport" ON public.day_program_transport
  USING (EXISTS (
    SELECT 1 FROM public.day_program_attendance a
    JOIN public.day_program_sessions s ON s.id = a.session_id
    WHERE a.id = day_program_transport.attendance_id
      AND public.access_can_write_day_program(s.organization_id, auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.day_program_attendance a
    JOIN public.day_program_sessions s ON s.id = a.session_id
    WHERE a.id = day_program_transport.attendance_id
      AND public.access_can_write_day_program(s.organization_id, auth.uid())));

ALTER POLICY "Org members read transport" ON public.day_program_transport
  USING (EXISTS (
    SELECT 1 FROM public.day_program_attendance a
    JOIN public.day_program_sessions s ON s.id = a.session_id
    WHERE a.id = day_program_transport.attendance_id
      AND public.is_org_member(s.organization_id, auth.uid())));
