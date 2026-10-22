-- Meds rebuild M1 (audit): medication records were readable by any agency
-- member. Checked pg_policies on live: the SELECT rules that were only
-- is_org_member were on controlled_med_counts, medication_transfers,
-- emar_log_addenda and medication_change_proposals (emar_logs already reads
-- through can_access_client_phi). Each is replaced in place with the
-- PHI-scoped rule (ALTER POLICY: the old org-wide rule is gone and the new
-- one is live in the same step).

alter policy "members read cmc" on public.controlled_med_counts
  using (public.can_access_client_phi(client_id));
alter policy "members read cmc" on public.controlled_med_counts rename to "phi readers read cmc";

alter policy "members read transfers" on public.medication_transfers
  using (public.can_access_client_phi(client_id));
alter policy "members read transfers" on public.medication_transfers rename to "phi readers read transfers";

alter policy "members read addenda" on public.emar_log_addenda
  using (exists (
    select 1 from public.emar_logs e
    where e.id = emar_log_id and public.can_access_client_phi(e.client_id)
  ));
alter policy "members read addenda" on public.emar_log_addenda rename to "phi readers read addenda";

alter policy "members read med proposals" on public.medication_change_proposals
  using (public.can_access_client_phi(client_id));
alter policy "members read med proposals" on public.medication_change_proposals rename to "phi readers read med proposals";
