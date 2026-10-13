-- Nectar rebuild N3: team members see a library document only when it is
-- published and meant for them (Decisions 2 and 5).
--
-- Same read policy as before with one added condition in the company/state
-- branch: a library document (library_group set) must be published and be
-- either for all team members or for a checked person. Documents outside the
-- library (library_group null, which includes every row the code on main
-- creates) read exactly as before. Owners and agency-wide admins still read
-- every document of their agency; client and staff documents are unchanged.

alter policy "org members read nectar docs"
  on public.nectar_documents
  using (
    public.is_org_admin_or_manager(organization_id, auth.uid())
    or (
      public.is_org_member(organization_id, auth.uid())
      and case
        when client_id is not null or owner_kind = 'client'
          then client_id is not null and public.can_access_client_phi(client_id)
        when owner_kind = 'staff'
          then staff_id = auth.uid()
        else (
          not (
            document_type = any (array['contract', '1056_budget', 'billing_record', 'timesheet', 'evv_report'])
            or coalesce(authoritative_kind, '') = 'provider_contract'
          )
          and (
            library_group is null
            or (
              library_status = 'published'
              and (audience_all or auth.uid() = any (policy_assigned_users))
            )
          )
        )
      end
    )
    or (
      public.is_hive_executive(auth.uid())
      and client_id is null
      and owner_kind <> 'client'
    )
  );
