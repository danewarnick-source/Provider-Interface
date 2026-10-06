-- Clients rebuild P8: notes on the advance directive card (additive only).
-- The card is dnr_status (None / DNR / POLST) + dnr_location + these notes,
-- with palliative care and hospice folded in.
alter table public.clients add column if not exists advance_directive_notes text;
