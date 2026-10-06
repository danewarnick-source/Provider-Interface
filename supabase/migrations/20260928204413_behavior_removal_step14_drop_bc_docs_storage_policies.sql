-- Step 14. Drop the storage policies that exist only for the behaviorist
-- document bucket. They subquery bc_documents and behavior_support_clients,
-- so they must go even though DROP TABLE does not remove them.
DROP POLICY IF EXISTS "bc_docs_read" ON storage.objects;
DROP POLICY IF EXISTS "bc_docs_write" ON storage.objects;
DROP POLICY IF EXISTS "bc_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "bc_docs_delete" ON storage.objects;
