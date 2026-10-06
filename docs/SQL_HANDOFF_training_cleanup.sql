-- Training cleanup handoff for the database owner.
-- Do not run this file as one script. Apply one step at a time, in order.
-- This file was not applied to the live database.
-- Live project: dhrrukdcigiiqksibdfb. Counts below are from a read on 2026-09-28.
--
-- Kept on purpose (do not drop):
--   training_topic_progress, training_completions,
--   company_obligations, company_obligation_instances, company_obligation_instance_assignees,
--   hive_training_catalog, hive_training_courses, hive_training_course_modules,
--   hive_training_seats, hive_training_assignments,
--   training_classes, training_class_roster,
--   client_specific_trainings, staff_checklist_completion, agency_policies,
--   evidence_items, evidence_files, import_cert_documents,
--   organizations.training_only (column still read by signup history and escalation),
--   host-home-certificates bucket, agency-policies bucket.
--
-- These names are not in the live database, so there is no drop step:
--   training_only_orders, training_only_seats, training_enrollments, training_products,
--   training_purchases, ce_ledger, ce_modules, ce_settings, staff_training_hours_entries,
--   certification_types, training_tracks, track_programs, track_assignments,
--   hive_training_orders, hive_training_order_items, hive_training_auto_renew_runs,
--   hive_training_renewal_intents.

-- Step 1. Copy the 21 course rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_courses AS TABLE public.courses;

-- Step 2. Copy the 76 course-module rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_course_modules AS TABLE public.course_modules;

-- Step 3. Copy the 364 lesson rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_lessons AS TABLE public.lessons;

-- Step 4. Copy the 1 course-assignment row into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_course_assignments AS TABLE public.course_assignments;

-- Step 5. Copy the 1 lesson-progress row into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_lesson_progress AS TABLE public.lesson_progress;

-- Step 6. Copy the 4 quiz-attempt rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_lesson_quiz_attempts AS TABLE public.lesson_quiz_attempts;

-- Step 7. Copy the 15 program-course rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_program_courses AS TABLE public.program_courses;

-- Step 8. Copy the 4 training-program rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_programs AS TABLE public.training_programs;

-- Step 9. Copy certification rows (none on 2026-09-28) into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_certifications AS TABLE public.certifications;

-- Step 10. Copy the 6 training-module rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_modules AS TABLE public.training_modules;

-- Step 11. Copy the 7 training-progress rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_user_training_progress AS TABLE public.user_training_progress;

-- Step 12. Copy the 1 auto-renew settings row into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_hive_training_auto_renew_settings AS TABLE public.hive_training_auto_renew_settings;

-- Step 13. Copy the 16 checklist-mapping rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_checklist_mappings AS TABLE public.training_checklist_mappings;

-- Step 14. Copy the 22 training-topic rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_topics AS TABLE public.training_topics;

-- Step 15. Copy training-assets file names into a backup table. Download the two files below before step 16. SQL cannot copy the file bytes.
--   pba/46baba14-6e53-4ebb-88da-51d614c82619/1779602372047-BYU_Cougars_logo.svg.png (53233 bytes)
--   pba/46baba14-6e53-4ebb-88da-51d614c82619/1779602446916-BYU_Cougars_logo.svg.png (53233 bytes)
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_assets_objects AS
SELECT * FROM storage.objects WHERE bucket_id = 'training-assets';

-- Step 16. Delete the two training-assets files after they have been downloaded.
DELETE FROM storage.objects WHERE bucket_id = 'training-assets';

-- Step 17. Remove the training-assets storage policies, then remove the bucket.
DROP POLICY IF EXISTS "org managers delete training assets" ON storage.objects;
DROP POLICY IF EXISTS "org managers update training assets" ON storage.objects;
DROP POLICY IF EXISTS "org managers upload training assets" ON storage.objects;
DROP POLICY IF EXISTS "training assets admin manage" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'training-assets';

-- Step 18. Remove the certificates-bucket policies (the bucket is empty), then remove the bucket. Leave host-home-certificates alone.
DROP POLICY IF EXISTS "managers read all cert files" ON storage.objects;
DROP POLICY IF EXISTS "users delete own cert files" ON storage.objects;
DROP POLICY IF EXISTS "users read own cert files" ON storage.objects;
DROP POLICY IF EXISTS "users update own cert files" ON storage.objects;
DROP POLICY IF EXISTS "users upload own cert files" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'certificates';

-- Step 19. Stop old course completion from issuing a row in certifications.
DROP TRIGGER IF EXISTS trg_issue_cert ON public.course_assignments;

-- Step 20. Stop lesson progress from recalculating the old course assignment.
DROP TRIGGER IF EXISTS trg_recalc_assignment_progress ON public.lesson_progress;

-- Step 21. Stop in-platform course completions from auto-checking the HR checklist. The checklist table itself stays.
DROP TRIGGER IF EXISTS trg_auto_check_hr_from_training ON public.training_completions;

-- Step 22. Remove the updated-at trigger on the baseline training table before that table is dropped.
DROP TRIGGER IF EXISTS trg_touch_baseline_training_updated_at ON public.staff_baseline_training_completions;

-- Step 23. Stop hard-deleting a client from touching provider_training_modules and training_person_modules.
CREATE OR REPLACE FUNCTION public.delete_client_hard(_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, organization_id, account_status, first_name, last_name
    INTO c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;

  IF NOT public.is_org_admin_or_manager(c.organization_id, _actor) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF COALESCE(c.account_status, 'active') <> 'archived' THEN
    RAISE EXCEPTION 'Client must be archived before deletion';
  END IF;

  BEGIN DELETE FROM public.staff_assignments WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.employee_client_assignments WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.controlled_med_counts WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.medication_transfers WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.client_belongings WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.client_spending_log WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.client_loans WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.client_medications WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.client_billing_code_rate_history WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.shift_completeness_flags WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.day_program_attendance WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_client_inventories WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_evacuation_drills WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_incident_reports WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_medical_logs WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_monthly_attendance WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_monthly_summaries WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_transfer_logs WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.hhs_emar_logs_deprecated WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.activity_reimbursement_requests WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.agency_bank_mappings WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.els_usage_ledger WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.pba_accounts WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.recurring_shift_patterns WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN UPDATE public.form_submissions SET client_id = NULL WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE public.nectar_documents SET client_id = NULL WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE public.hrc_reviews SET client_id = NULL WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE public.host_supervision_contacts SET client_id = NULL WHERE client_id = _client_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM public.clients WHERE id = _client_id;

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', _client_id,
    'client_name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,''))
  );
END;
$function$;

-- Step 24. Point the eMAR medication-training check at Evidence. If the org has no medication evidence, the pass is still allowed.
CREATE OR REPLACE FUNCTION public.is_med_assist_current(_user uuid, _org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH med_items AS (
    SELECT ei.id, ei.subject_id, ei.expires_on
    FROM public.evidence_items ei
    WHERE ei.organization_id = _org
      AND ei.subject_type = 'staff'
      AND (
        ei.requirement_key ILIKE '%med_assist%'
        OR ei.requirement_key ILIKE '%medication%'
        OR ei.title ILIKE '%medication%'
        OR ei.title ILIKE '%med assist%'
        OR ei.title ILIKE '%med-assist%'
      )
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM med_items) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM med_items m
      JOIN public.evidence_files ef ON ef.item_id = m.id
      WHERE m.subject_id = _user
        AND (m.expires_on IS NULL OR m.expires_on >= current_date)
        AND (
          ef.storage_path IS NOT NULL
          OR ef.filename IS NOT NULL
          OR ef.attested_at IS NOT NULL
        )
    )
  END;
$function$;

-- Step 25. Point the eMAR LPN/RN license check at Evidence license rows instead of external certifications.
CREATE OR REPLACE FUNCTION public.user_has_active_credential(_user_id uuid, _org_id uuid, _cert_type text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.evidence_items ei
      JOIN public.evidence_files ef ON ef.item_id = ei.id
     WHERE ei.subject_type = 'staff'
       AND ei.subject_id = _user_id
       AND ei.organization_id = _org_id
       AND ei.requirement_key = CASE lower(_cert_type)
            WHEN 'lpn' THEN 'pm1_lpn_license'
            WHEN 'rn' THEN 'pm2_rn_license'
            ELSE NULL
          END
       AND (ei.expires_on IS NULL OR ei.expires_on >= current_date)
       AND (
         ef.storage_path IS NOT NULL
         OR ef.filename IS NOT NULL
         OR ef.attested_at IS NOT NULL
       )
  );
$function$;

-- Step 26. Drop the old certificate-issue function. The in-platform course prints its own certificate and does not use this.
DROP FUNCTION IF EXISTS public.issue_certificate_on_completion();

-- Step 27. Drop the old lesson-progress recalculation function.
DROP FUNCTION IF EXISTS public.recalc_assignment_progress();

-- Step 28. Drop the public certificate lookup used by /verify. The in-platform course does not call it.
DROP FUNCTION IF EXISTS public.verify_certificate(text);

-- Step 29. Drop the second public certificate lookup. Same reason as step 28.
DROP FUNCTION IF EXISTS public.verify_certification(text);

-- Step 30. Drop the HR auto-check function now that its trigger is gone.
DROP FUNCTION IF EXISTS public.auto_check_hr_from_training();

-- Step 31. Drop the baseline-training timestamp function now that its trigger is gone.
DROP FUNCTION IF EXISTS public.touch_baseline_training_updated_at();

-- Step 32. Drop quiz attempts (4 rows, already backed up).
DROP POLICY IF EXISTS "managers read attempts" ON public.lesson_quiz_attempts;
DROP POLICY IF EXISTS "user own attempts" ON public.lesson_quiz_attempts;
DROP TABLE IF EXISTS public.lesson_quiz_attempts;

-- Step 33. Drop lesson progress (1 row, already backed up).
DROP POLICY IF EXISTS "user reads own lesson progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "user writes own lesson progress" ON public.lesson_progress;
DROP TABLE IF EXISTS public.lesson_progress;

-- Step 34. Drop lessons (364 rows, already backed up).
DROP POLICY IF EXISTS "managers write lessons" ON public.lessons;
DROP POLICY IF EXISTS "read lessons via course" ON public.lessons;
DROP TABLE IF EXISTS public.lessons;

-- Step 35. Drop course modules (76 rows, already backed up).
DROP POLICY IF EXISTS "managers write modules" ON public.course_modules;
DROP POLICY IF EXISTS "read modules via course" ON public.course_modules;
DROP TABLE IF EXISTS public.course_modules;

-- Step 36. Drop program acknowledgements (empty).
DROP POLICY IF EXISTS "managers read acks" ON public.program_acknowledgements;
DROP POLICY IF EXISTS "user own acks" ON public.program_acknowledgements;
DROP TABLE IF EXISTS public.program_acknowledgements;

-- Step 37. Drop program courses (15 rows, already backed up).
DROP POLICY IF EXISTS "managers write program courses" ON public.program_courses;
DROP POLICY IF EXISTS "read program courses via program" ON public.program_courses;
DROP TABLE IF EXISTS public.program_courses;

-- Step 38. Drop program assignments (empty).
DROP POLICY IF EXISTS "managers assign programs" ON public.program_assignments;
DROP POLICY IF EXISTS "managers delete program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "user reads own program assignment" ON public.program_assignments;
DROP POLICY IF EXISTS "user updates own program assignment" ON public.program_assignments;
DROP TABLE IF EXISTS public.program_assignments;

-- Step 39. Drop course assignments (1 row, already backed up).
DROP POLICY IF EXISTS "managers assign" ON public.course_assignments;
DROP POLICY IF EXISTS "managers delete assign" ON public.course_assignments;
DROP POLICY IF EXISTS "super admins read all assignments" ON public.course_assignments;
DROP POLICY IF EXISTS "user reads own" ON public.course_assignments;
DROP POLICY IF EXISTS "user updates own progress" ON public.course_assignments;
DROP TABLE IF EXISTS public.course_assignments;

-- Step 40. Drop old certifications (backed up in step 9, including when the table is empty).
DROP POLICY IF EXISTS "org admins delete certs" ON public.certifications;
DROP POLICY IF EXISTS "org admins manage certs" ON public.certifications;
DROP POLICY IF EXISTS "org members read certs" ON public.certifications;
DROP POLICY IF EXISTS "system issues cert" ON public.certifications;
DROP TABLE IF EXISTS public.certifications;

-- Step 41. Drop the old courses table (21 rows, already backed up).
DROP POLICY IF EXISTS "managers write courses" ON public.courses;
DROP POLICY IF EXISTS "members read courses" ON public.courses;
DROP TABLE IF EXISTS public.courses;

-- Step 42. Drop training programs (4 rows, already backed up).
DROP POLICY IF EXISTS "managers write programs" ON public.training_programs;
DROP POLICY IF EXISTS "members read programs" ON public.training_programs;
DROP POLICY IF EXISTS "super admins write programs" ON public.training_programs;
DROP TABLE IF EXISTS public.training_programs;

-- Step 43. Drop the assignment status enum. Only the two tables just dropped used it.
DROP TYPE IF EXISTS public.assignment_status;

-- Step 44. Drop per-user progress on the old training modules (7 rows, already backed up).
DROP POLICY IF EXISTS "managers assign training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "managers read training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "managers update training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "org admins read member training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users delete own progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users insert own progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users read own progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users update own progress" ON public.user_training_progress;
DROP TABLE IF EXISTS public.user_training_progress;

-- Step 45. Drop the old training modules (6 rows, already backed up).
DROP POLICY IF EXISTS "anyone authenticated can read training modules" ON public.training_modules;
DROP TABLE IF EXISTS public.training_modules;

-- Step 46. Drop checklist mappings (16 rows, already backed up). staff_checklist_completion stays.
DROP POLICY IF EXISTS "authenticated read training_checklist_mappings" ON public.training_checklist_mappings;
DROP POLICY IF EXISTS "hive exec manage training_checklist_mappings" ON public.training_checklist_mappings;
DROP TABLE IF EXISTS public.training_checklist_mappings;

-- Step 47. Drop training topics (22 rows, already backed up).
DROP POLICY IF EXISTS "anyone authenticated reads training topics" ON public.training_topics;
DROP TABLE IF EXISTS public.training_topics;

-- Step 48. Drop empty provider training modules.
DROP POLICY IF EXISTS "admins manage org training content" ON public.provider_training_modules;
DROP POLICY IF EXISTS "staff read published person modules if assigned" ON public.provider_training_modules;
DROP POLICY IF EXISTS "staff read published policies" ON public.provider_training_modules;
DROP TABLE IF EXISTS public.provider_training_modules;

-- Step 49. Drop empty person-specific training modules.
DROP POLICY IF EXISTS "managers manage person modules delete" ON public.training_person_modules;
DROP POLICY IF EXISTS "managers manage person modules insert" ON public.training_person_modules;
DROP POLICY IF EXISTS "managers manage person modules update" ON public.training_person_modules;
DROP POLICY IF EXISTS "managers read org person modules" ON public.training_person_modules;
DROP POLICY IF EXISTS "staff read own person modules" ON public.training_person_modules;
DROP TABLE IF EXISTS public.training_person_modules;

-- Step 50. Drop empty hive training certificates. Class seats and assignments stay.
DROP POLICY IF EXISTS "certs insert for own assignment" ON public.hive_training_certificates;
DROP POLICY IF EXISTS "certs read own or org" ON public.hive_training_certificates;
DROP TABLE IF EXISTS public.hive_training_certificates;

-- Step 51. Drop empty hive module progress. Course modules and assignments stay.
DROP POLICY IF EXISTS "module progress read" ON public.hive_training_module_progress;
DROP POLICY IF EXISTS "module progress staff write" ON public.hive_training_module_progress;
DROP TABLE IF EXISTS public.hive_training_module_progress;

-- Step 52. Drop auto-renew settings (1 row, already backed up).
DROP POLICY IF EXISTS "Org admins manage auto-renew settings" ON public.hive_training_auto_renew_settings;
DROP POLICY IF EXISTS "Service role full access auto-renew settings" ON public.hive_training_auto_renew_settings;
DROP TABLE IF EXISTS public.hive_training_auto_renew_settings;

-- Step 53. Drop the auto-renew scope enum. Only the settings table used it.
DROP TYPE IF EXISTS public.hive_training_auto_renew_scope;

-- Step 54. Drop empty org training orders.
DROP POLICY IF EXISTS "Org admins can insert training orders" ON public.org_training_orders;
DROP POLICY IF EXISTS "Org admins can update training orders" ON public.org_training_orders;
DROP POLICY IF EXISTS "Org members can view training orders" ON public.org_training_orders;
DROP TABLE IF EXISTS public.org_training_orders;

-- Step 55. Drop empty baseline training completions. Evidence is the record now.
DROP POLICY IF EXISTS "baseline self attestation write" ON public.staff_baseline_training_completions;
DROP POLICY IF EXISTS "baseline training view" ON public.staff_baseline_training_completions;
DROP POLICY IF EXISTS "baseline training write" ON public.staff_baseline_training_completions;
DROP TABLE IF EXISTS public.staff_baseline_training_completions;

-- Step 56. Drop empty training runs.
DROP POLICY IF EXISTS "training_runs_select_member" ON public.training_runs;
DROP POLICY IF EXISTS "training_runs_write_admin" ON public.training_runs;
DROP TABLE IF EXISTS public.training_runs;

-- Step 57. Drop empty external certifications. Evidence holds licenses and certificates now.
DROP POLICY IF EXISTS "user deletes own pending ext certs" ON public.external_certifications;
DROP POLICY IF EXISTS "user reads own ext certs" ON public.external_certifications;
DROP POLICY IF EXISTS "user updates own pending ext certs" ON public.external_certifications;
DROP POLICY IF EXISTS "user uploads own ext certs" ON public.external_certifications;
DROP TABLE IF EXISTS public.external_certifications;
