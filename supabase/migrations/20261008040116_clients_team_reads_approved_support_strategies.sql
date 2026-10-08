-- Team members who work with a client may read that client's APPROVED
-- (published) support strategies, so the clock in/out "Focus for this shift"
-- block and daily notes can show them (SOW §1.24(6), §18.3(2)(E)). Same
-- visibility rule as client_goals. Drafts stay admin-only. Additive.
create policy "team reads approved support strategies"
  on public.client_specific_trainings
  for select
  using (
    training_type = 'support_strategies'
    and status = 'published'
    and (
      public.access_can_see_client(client_id, auth.uid())
      or (public.is_org_member(organization_id, auth.uid()) and public.can_access_client_phi(client_id))
    )
  );
