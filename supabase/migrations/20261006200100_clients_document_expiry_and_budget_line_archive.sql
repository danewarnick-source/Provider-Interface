-- Clients rebuild P9 (additive only):
--  * client_documents.expires_on: when a document on the client file stops
--    counting (exams, consents, agreements). Null = no expiry.
--  * client_budget_lines.archived_at / archived_by: removing a monthly budget
--    line archives it instead of deleting it (7-year retention).
alter table public.client_documents add column if not exists expires_on date;
alter table public.client_budget_lines add column if not exists archived_at timestamptz;
alter table public.client_budget_lines add column if not exists archived_by uuid;
