-- PHASE B — apply only after the code that stops calling these is deployed
-- (deleteClientPermanently / getClientDeletionImpact removed from
-- src/lib/client-lifecycle.functions.ts). Until then main still references
-- them; trg_clients_prevent_delete already makes delete_client_hard fail.

DROP FUNCTION IF EXISTS public.delete_client_hard(uuid);
DROP FUNCTION IF EXISTS public.client_deletion_impact(uuid);
