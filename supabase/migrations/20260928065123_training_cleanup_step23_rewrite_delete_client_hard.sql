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
