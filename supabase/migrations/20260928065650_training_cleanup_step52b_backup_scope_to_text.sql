-- Step 52b. Convert the backup scope column to text so the hive_training_auto_renew_scope enum can be dropped in step 53.
ALTER TABLE public._backup_20260928_hive_training_auto_renew_settings ALTER COLUMN scope TYPE text USING scope::text;
