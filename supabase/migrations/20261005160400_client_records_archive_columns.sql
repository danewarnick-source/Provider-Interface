-- Removing a client document or emergency contact from the profile archives it
-- instead of deleting it. Additive only: existing readers keep working.
--   * Emergency contacts: the profile lists filter archived_at IS NULL.
--   * Documents (client_documents and client-owned nectar_documents): a removed
--     file is retired to status 'outdated' and stays in the Outdated / Superseded
--     retention list; archived_at/archived_by record who removed it and when.

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.nectar_documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.client_emergency_contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
