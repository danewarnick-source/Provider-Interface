-- Nectar rebuild N4: a private bucket for state rule files (Decision 6).
-- A hive executive uploads a state rule, or a new version of one, on
-- /dashboard/hive-exec/knowledge. The file goes straight here with a signed
-- upload URL and the server reads its text into state_rule_documents.
-- Only hive executives add or read these files; agencies read a rule's text
-- and sections, never the file. No update or delete policy: files are kept.

insert into storage.buckets (id, name, public, file_size_limit)
values ('state-rules', 'state-rules', false, 26214400)
on conflict (id) do nothing;

create policy "hive execs upload state rule files"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'state-rules' and public.is_hive_executive(auth.uid()));

create policy "hive execs read state rule files"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'state-rules' and public.is_hive_executive(auth.uid()));
