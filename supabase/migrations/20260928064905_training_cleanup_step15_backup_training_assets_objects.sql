-- Step 15. Copy training-assets file names into a backup table. Download the two files below before step 16. SQL cannot copy the file bytes.
--   pba/46baba14-6e53-4ebb-88da-51d614c82619/1779602372047-BYU_Cougars_logo.svg.png (53233 bytes)
--   pba/46baba14-6e53-4ebb-88da-51d614c82619/1779602446916-BYU_Cougars_logo.svg.png (53233 bytes)
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_assets_objects AS
SELECT * FROM storage.objects WHERE bucket_id = 'training-assets';
