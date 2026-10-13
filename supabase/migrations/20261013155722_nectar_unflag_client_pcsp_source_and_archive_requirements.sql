-- Nectar rebuild N2: data fixes. Updates only; nothing is deleted or dropped.

-- 1. Client documents stay on the client profile (Decision 1). One client
--    PCSP (owner_kind = 'client') was flagged as an agency source. Unflag it
--    the way markAsAuthoritativeSource does (the source kind is cleared too).
update public.nectar_documents
   set is_authoritative_source = false,
       authoritative_kind = null
 where owner_kind = 'client'
   and is_authoritative_source = true;

-- 2. The requirements pipeline is gone (Decision 11). Archive every
--    nectar_requirements row with the existing archived state,
--    review_status = 'removed', and keep the previous status in metadata for
--    the N8 export. activation_state is left alone: scheduler qualification
--    checks join on it. Rows already stamped are skipped, so a re-run is a
--    no-op.
update public.nectar_requirements
   set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
         'archived', jsonb_build_object(
           'at', now(),
           'by', 'nectar_rebuild_n2',
           'previous_review_status', review_status)),
       review_status = 'removed'
 where not (coalesce(metadata, '{}'::jsonb) ? 'archived');
