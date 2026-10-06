-- Evidence send-to-employee admin message.
-- Additive only. Do NOT drop columns or tables.
-- Dane pastes this in Lovable's SQL editor after the Phase 1 tables exist.
-- See docs/SQL_HANDOFF.md.
--
-- App is graceful if this column is missing: send still marks sent_to_staff
-- and skips the message with a friendly note. Persistence stays on evidence_items.

ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS send_message text;
