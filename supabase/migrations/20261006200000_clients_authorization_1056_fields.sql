-- Clients rebuild P9: the 1056 number and approved date on each
-- authorization row (additive only). An authorization is "ended" by setting
-- service_end_date; rows are never deleted.
alter table public.client_billing_codes add column if not exists authorization_number text;
alter table public.client_billing_codes add column if not exists authorization_approved_on date;
