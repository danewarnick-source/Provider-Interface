// Client autofill, custom fields: profile fields stored as custom fields, any
// unmapped extracted field kept as a generic custom field so nothing is lost,
// and tracked fields with no data flagged "unknown" for someone to confirm.
import { loadClientContacts } from "../contacts/contacts";
import { guardianGap, guardianStatus } from "../contacts/guardian";
import { LEGACY_ALERT_KEY, LEGACY_CONTACT_KEYS, LEGACY_SINGLE_SOURCE_KEYS } from "../legacy-fields";
import {
  type ExtractedField,
  type ImportRun,
  fieldArray,
  fieldBool,
  fieldDate,
  fieldText,
} from "./import-fields";

/**
 * Profile fields kept as custom fields, any other extracted key as a generic
 * custom field, then the "unknown" sweep of tracked fields.
 */
export async function applyImportedCustomFields(run: ImportRun): Promise<void> {
  const { supabase, organizationId, clientId, ok, byKey, suggested, customCreated, onError } = run;

  // ── Registry-driven pass for custom-backed profile fields ──────────────
  // Bind extraction → store under the SAME keys the wizard / profile read
  // back. Any extracted field matching a registry custom field's `key` or
  // one of its `extractionKeys` is persisted via writeProfileFieldValue.
  const { CLIENT_PROFILE_FIELDS } = await import("@/lib/clients/profile/profile-field-registry");
  const { writeProfileFieldValue } = await import("@/lib/clients/profile/profile-fields");
  const registryConsumed = new Set<string>();
  for (const field of CLIENT_PROFILE_FIELDS) {
    if (field.storage.kind !== "custom") continue;
    const aliasKeys = [field.key, ...(field.extractionKeys ?? [])];
    let chosen: ExtractedField | null = null;
    for (const k of aliasKeys) {
      const f = byKey.get(k);
      if (f) { chosen = f; break; }
    }
    if (!chosen) continue;
    let value: string | boolean | string[] | null = null;
    if (field.type === "bool") value = fieldBool(chosen);
    else if (field.type === "array") value = fieldArray(chosen);
    else if (field.type === "date") value = fieldDate(chosen);
    else value = fieldText(chosen);
    if (value == null || (Array.isArray(value) && value.length === 0) ||
        (typeof value === "string" && value.trim().length === 0)) {
      continue;
    }
    try {
      await writeProfileFieldValue(supabase, organizationId, clientId, field, value);
      for (const k of aliasKeys) registryConsumed.add(k);
      customCreated.push(field.key);
    } catch (err) {
      suggested.push(`custom:${field.key} (${(err as Error).message})`);
      await onError("custom_field_registry_error", `${field.key}: ${(err as Error).message}`);
    }
  }

  // Anything else without a clients column → generic custom field so nothing
  // extracted is lost. Unknown keys are logged once so we can detect future drops.
  const KNOWN_CORE = new Set<string>([
    "first_name", "last_name", "full_name", "dob", "date_of_birth", "medicaid_id", "phone",
    "physical_address",
    // Mailing address is no longer kept: known so it is dropped, not turned into a custom field.
    "mailing_address",
    // Contacts (→ client_contacts) and the must-knows alert (→ special_directions)
    ...Object.keys(LEGACY_CONTACT_KEYS), LEGACY_ALERT_KEY,
    "is_own_guardian",
    // self_admin_med_support is known so it is dropped: support is per medication (how_taken).
    "special_directions", "dysphagia", "self_admin_med_support",
    "allergies", "swallowing_alerts", "pcsp_goal",
    "billing_code_row", "service_code", "rate", "max_units", "unit_type",
    "weekly_cap_units", "plan_start", "plan_end",
    "team_name", "staff_ratio",
    "client_medication", "pcsp_has_medications",
    // Medical / compliance
    "bsp_status", "housing_voucher", ...Object.values(LEGACY_SINGLE_SOURCE_KEYS),
    "plan_year", "disability_category", "pcsp_expiration_date",
    "advanced_directives", "emergency_medical_treatment_authorization",
    "has_abi", "hr_applicable", "dnr_applicable",
    // Array columns
    "diagnoses", "chronic_conditions", "immunizations",
    "court_orders", "rights_restrictions",
    "roommates", "personal_belongings_inventory",
    // SOW §1.10 dates
    "admission_date", "discharge_date", "pcsp_expiration_date",
    // 1056 header fields
    "form_1056_number", "form_1056_approved_date",
    // SOW supplemental
    "level_of_need",
    "grievance_acknowledged", "grievance_signed_date",
    // End-of-life / advanced care
    "dnr_status", "dnr_location", "polst_status", "palliative_care_status", "hospice_status",
    // Expanded profile capture (routed via registry custom fields; adding here so
    // the "unmapped" fallback log doesn't warn on them, and so they're recognized
    // as core PCSP fields rather than free-form custom attributes).
    "gender", "pronouns", "preferred_name", "primary_language", "communication_notes",
    "race", "ethnicity", "marital_status",
    "secondary_phone", "email", "county",
    "mobility_notes", "adaptive_equipment", "dietary_restrictions",
    "vision_status", "hearing_status", "weight", "height", "blood_type",
    "day_program_name", "day_program_phone", "transportation_notes", "funding_source",
    "secondary_insurance", "medicare_id",
    "pcsp_author_name", "pcsp_meeting_date", "pcsp_effective_start", "pcsp_review_date",
    "pcsp_signed_by_client", "pcsp_signed_by_guardian",
    "representative_payee",
  ]);
  const seenCustom = new Set<string>();
  for (const f of ok) {
    if (KNOWN_CORE.has(f.field_key)) continue;
    if (registryConsumed.has(f.field_key)) continue;
    if (seenCustom.has(f.field_key)) continue;
    seenCustom.add(f.field_key);
    console.warn(`[client-import] unmapped field_key "${f.field_key}" — routing to custom field`);
    const val = fieldText(f) ?? (fieldArray(f)?.join(", ") ?? null);
    if (!val) continue;
    try {
      const { data: def } = await supabase
        .from("custom_field_definitions")
        .upsert(
          {
            organization_id: organizationId,
            entity_kind: "client",
            field_key: f.field_key,
            field_label: f.field_key.replace(/_/g, " "),
            data_type: "text",
            source: "import",
          },
          { onConflict: "organization_id,entity_kind,field_key" },
        )
        .select("id")
        .single();
      if (!def) continue;
      const { data: existing } = await supabase
        .from("custom_field_values")
        .select("id")
        .eq("definition_id", def.id)
        .eq("entity_id", clientId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("custom_field_values")
          .update({ value_text: val })
          .eq("id", existing.id);
      } else {
        await supabase.from("custom_field_values").insert({
          organization_id: organizationId,
          definition_id: def.id,
          entity_id: clientId,
          entity_kind: "client",
          value_text: val,
        });
      }
      customCreated.push(f.field_key);
    } catch (err) {
      // Non-fatal: surface as a soft suggestion AND audit so it can't vanish.
      suggested.push(`custom:${f.field_key}`);
      await onError("custom_field_unknown_error", `${f.field_key}: ${(err as Error).message}`);
    }
  }


  // ── Tracked-field unknown sweep ─────────────────────────────────────────
  // For each field we explicitly track, if it has no real data AND no
  // existing confirmation, flag it "unknown" in clients.field_confirmations
  // and queue a NECTAR question in `suggested`. Never guesses.
  try {
    const { TRACKED_FIELDS } = await import("@/lib/field-confirmations");
    const { data: cur } = await supabase
      .from("clients")
      .select(
        "allergies, dysphagia, swallowing_alerts, special_directions, is_own_guardian, field_confirmations",
      )
      .eq("id", clientId)
      .maybeSingle();
    if (cur) {
      const { count: medCount } = await supabase
        .from("client_medications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("client_id", clientId)
        .eq("is_active", true);

      // Custom-field-backed tracked fields.
      const builtIn = new Set([
        "medications", "allergies", "dysphagia", "swallowing_alerts",
        LEGACY_ALERT_KEY, "guardian",
      ]);
      const customKeys = TRACKED_FIELDS
        .map((f: { key: string }) => f.key)
        .filter((k: string) => !builtIn.has(k));
      const { data: defs } = await supabase
        .from("custom_field_definitions")
        .select("id, field_key")
        .eq("organization_id", organizationId)
        .eq("entity_kind", "client")
        .in("field_key", customKeys);
      const defIds = ((defs ?? []) as Array<{ id: string; field_key: string }>).map((d) => d.id);
      const { data: vals } = defIds.length
        ? await supabase
            .from("custom_field_values")
            .select("definition_id, value_text, value_boolean")
            .eq("entity_id", clientId)
            .in("definition_id", defIds)
        : { data: [] as Array<{ definition_id: string; value_text: string | null; value_boolean: boolean | null }> };
      const keyByDef = new Map(
        ((defs ?? []) as Array<{ id: string; field_key: string }>).map((d) => [d.id, d.field_key]),
      );
      const customHas = new Set<string>();
      for (const v of (vals ?? []) as Array<{ definition_id: string; value_text: string | null; value_boolean: boolean | null }>) {
        const key = keyByDef.get(v.definition_id);
        if (!key) continue;
        if ((v.value_text && v.value_text.trim().length) || v.value_boolean === true) customHas.add(key);
      }

      const hasMap: Record<string, boolean> = {
        medications: (medCount ?? 0) > 0,
        allergies: Array.isArray(cur.allergies) && cur.allergies.length > 0,
        dysphagia: cur.dysphagia === true,
        swallowing_alerts: Array.isArray(cur.swallowing_alerts) && cur.swallowing_alerts.length > 0,
        [LEGACY_ALERT_KEY]: !!(cur.special_directions && String(cur.special_directions).trim()),
        guardian:
          guardianGap(
            guardianStatus(cur.is_own_guardian, await loadClientContacts(supabase, [clientId])),
          ) === null,
      };
      for (const k of customKeys) hasMap[k] = customHas.has(k);

      const existing = (cur.field_confirmations as Record<string, string> | null) ?? {};
      const next: Record<string, string> = { ...existing };
      let changed = false;
      for (const f of TRACKED_FIELDS) {
        if (hasMap[f.key]) continue;
        if (existing[f.key]) continue;
        next[f.key] = "unknown";
        changed = true;
        suggested.push(`Confirm: ${(f as { question: string }).question}`);
      }
      if (changed) {
        await supabase
          .from("clients")
          .update({ field_confirmations: next })
          .eq("id", clientId);
      }
    }
  } catch (err) {
    await onError("confirmation_sweep_error", (err as Error).message);
  }
}
