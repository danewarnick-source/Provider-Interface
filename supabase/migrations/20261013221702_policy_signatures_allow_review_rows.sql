-- Nectar rebuild N3: "Mark as reviewed" (Decision 4) writes one
-- policy_signatures row per person per document version: document_id,
-- document_version, user_id, signer_full_name, signed_at, attestation
-- "I have reviewed this version.", consent_accepted and a content hash.
--
-- typed_signature is the only NOT NULL column a review can't fill, so it is
-- relaxed. Review rows leave it null; the old typed-signature flow keeps
-- filling it. A review is idempotent per version: a second review of the same
-- version by the same person is refused by this index.

alter table public.policy_signatures alter column typed_signature drop not null;

create unique index if not exists policy_signatures_one_review_per_version
  on public.policy_signatures (document_id, document_version, user_id)
  where typed_signature is null;

comment on column public.policy_signatures.typed_signature is
  'Typed e-signature from the sign-policy flow. Null on "Mark as reviewed" rows, which are one per person per document version.';
