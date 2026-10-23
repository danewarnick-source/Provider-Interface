// =============================================================
// Shared client autofill — apply parsed PCSP/intake/1056 fields
// onto a clients row and seed client_billing_codes.
//
// Used by:
//  - per-client document upload (src/lib/nectar-documents.functions.ts)
//  - client upload helpers (src/lib/import-checklist.functions.ts)
//
// Behavior:
//  - Confidence-gated (>= 0.6) for AI-sourced fields.
//  - Never overwrites existing non-empty scalars (suggests instead).
//  - Merges + dedupes array columns.
//  - Upserts client_billing_codes by (org, client, service_code).
// =============================================================
//
// The billing-code, medication and custom-field passes live in import-codes.ts,
// import-meds.ts and import-custom-fields.ts; field readers in import-fields.ts.
import { enrichNamesFromFull, firstNameWithMiddle } from "@/lib/person-name";
import { denverYmd } from "@/lib/denver-date";
import { activeContacts, loadClientContacts } from "../contacts/contacts";
import { applyContactMergePlan, planContactMerge } from "../contacts/contacts-merge";
import { loadActiveCodesAsService } from "../services/codes";
import { appendGoalsToCurrentPlan } from "../plans/plans-write";
import {
  LEGACY_ALERT_KEY,
  LEGACY_CONTACT_KEYS,
  LEGACY_SINGLE_SOURCE_KEYS,
  legacyContactsForClient,
  singleSourcesFromLegacy,
} from "../legacy-fields";
import {
  type ApplyExtractedCtx,
  type ExtractedField,
  type ImportRun,
  CONFIDENCE_THRESHOLD,
  fieldArray,
  fieldBool,
  fieldDate,
  fieldText,
} from "./import-fields";
import { applyImportedCodes } from "./import-codes";
import { applyImportedMeds } from "./import-meds";
import { applyImportedCustomFields } from "./import-custom-fields";

export async function applyExtractedFieldsToClient(
  ctx: ApplyExtractedCtx,
): Promise<{ autofilled: string[]; suggested: string[]; customCreated: string[] }> {
  const { supabase, organizationId, clientId, fields } = ctx;
  const sourceDocumentType = ctx.sourceDocumentType ?? null;
  const importJobId = ctx.importJobId ?? null;
  const autofilled: string[] = [];
  const suggested: string[] = [];
  const customCreated: string[] = [];

  const onError = async (action: string, message: string) => {
    try {
      if (ctx.onError) await ctx.onError(action, message);
    } catch { /* never let an audit failure break a save */ }
  };

  const writeScalarConflict = async (
    field: string,
    existing: unknown,
    incoming: unknown,
  ) => {
    try {
      await supabase.from("import_merge_flags").insert({
        organization_id: organizationId,
        client_id: clientId,
        import_job_id: importJobId,
        field,
        kind: "scalar_conflict",
        existing_value: existing == null ? null : String(existing).slice(0, 4000),
        incoming_value: incoming == null ? null : String(incoming).slice(0, 4000),
        suggested_value: incoming == null ? null : String(incoming).slice(0, 4000),
        source_document_type: sourceDocumentType,
      });
    } catch (e) {
      await onError("merge_flag_insert_error", (e as Error).message);
    }
  };

  const writeDuplicateFlag = async (field: string, existing: string, incoming: string) => {
    try {
      await supabase.from("import_merge_flags").insert({
        organization_id: organizationId,
        client_id: clientId,
        import_job_id: importJobId,
        field,
        kind: "possible_duplicate",
        existing_value: existing.slice(0, 4000),
        incoming_value: incoming.slice(0, 4000),
        source_document_type: sourceDocumentType,
      });
    } catch (e) {
      await onError("merge_flag_insert_error", (e as Error).message);
    }
  };



  const ok = fields.filter((f) => (f.confidence ?? 0) >= CONFIDENCE_THRESHOLD);
  const byKey = new Map<string, ExtractedField>();
  for (const f of ok) {
    if (!byKey.has(f.field_key)) byKey.set(f.field_key, f);
  }
  const run: ImportRun = {
    supabase,
    organizationId,
    clientId,
    ok,
    byKey,
    sourceDocumentType,
    autofilled,
    suggested,
    customCreated,
    onError,
    writeScalarConflict,
  };

  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select(
      "id, first_name, last_name, date_of_birth, medicaid_id, phone_number, physical_address, " +
      "is_own_guardian, " +
      "special_directions, allergies, dysphagia, swallowing_alerts, diets, mobility, " +
      "team_id, " +
      "bsp_status, insurance, about_me, housing_voucher, " +
      "plan_year, disability_category, staff_ratio, " +
      "advanced_directives, emergency_medical_treatment_authorization, " +
      "diagnoses, chronic_conditions, immunizations, court_orders, rights_restrictions, " +
      "roommates, personal_belongings_inventory, " +
      "grievance_acknowledged, grievance_signed_date, " +
      "dnr_status, dnr_location, polst_status, palliative_care_status, hospice_status, " +
      "admission_date, discharge_date, form_1056_number, form_1056_approved_date",
    )
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!client) throw new Error("Client not found");

  const update: Record<string, unknown> = {};

  const setScalarText = (column: string, key: string) => {
    const f = byKey.get(key);
    if (!f) return;
    const v = fieldText(f);
    if (!v) return;
    const cur = (client as Record<string, unknown>)[column];
    if (cur === null || cur === undefined || cur === "") {
      update[column] = v;
      autofilled.push(column);
    } else if (cur !== v) {
      suggested.push(column);
      // Surface as a structured merge flag for admin review.
      void writeScalarConflict(column, cur, v);
    }
  };
  const setScalarBool = (column: string, key: string) => {
    const f = byKey.get(key);
    if (!f) return;
    const v = fieldBool(f);
    if (v === null) return;
    const cur = (client as Record<string, unknown>)[column];
    if (cur === null || cur === undefined || cur === false) {
      if (cur !== v) {
        update[column] = v;
        autofilled.push(column);
      }
    } else if (cur !== v) {
      suggested.push(column);
      void writeScalarConflict(column, cur, v);
    }
  };
  const setScalarDate = (column: string, key: string) => {
    const f = byKey.get(key);
    if (!f) return;
    const v = fieldDate(f);
    if (!v) return;
    const cur = (client as Record<string, unknown>)[column];
    if (cur === null || cur === undefined || cur === "") {
      update[column] = v;
      autofilled.push(column);
    } else if (cur !== v) {
      suggested.push(column);
      void writeScalarConflict(column, cur, v);
    }
  };

  // Lightweight token-set Jaccard for "is this the same item, worded differently?".
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 2),
    );
  const looksDuplicate = (a: string, b: string): boolean => {
    const al = a.trim().toLowerCase();
    const bl = b.trim().toLowerCase();
    if (al === bl) return false; // exact dupe is already collapsed by Set()
    if (al.includes(bl) || bl.includes(al)) return true;
    const ta = tokenize(a);
    const tb = tokenize(b);
    if (ta.size === 0 || tb.size === 0) return false;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    const union = ta.size + tb.size - inter;
    return union > 0 && inter / union >= 0.6;
  };

  const mergeArrayColumn = (column: string, additions: string[]) => {
    if (!additions.length) return;
    const cur = ((client as Record<string, unknown>)[column] as string[] | null) ?? [];
    // Detect possible duplicates against the existing list before unioning.
    for (const add of additions) {
      for (const existing of cur) {
        if (looksDuplicate(existing, add)) {
          void writeDuplicateFlag(column, existing, add);
        }
      }
    }
    const merged = Array.from(
      new Set([...cur, ...additions].map((s) => s.trim()).filter(Boolean)),
    );
    if (merged.length > cur.length) {
      update[column] = merged;
      autofilled.push(column);
    }
  };

  setScalarText("first_name", "first_name");
  setScalarText("last_name", "last_name");
  // If full_name carries a middle initial the model dropped from first/last,
  // fold it into first_name (clients has no middle_name column).
  {
    const fullF = byKey.get("full_name");
    const midF = byKey.get("middle_name");
    const fullText = fullF ? fieldText(fullF) : null;
    const midText = midF ? fieldText(midF) : null;
    if (fullText || midText) {
      const curFirst = (update.first_name as string | undefined) ?? (client.first_name as string | null);
      const curLast = (update.last_name as string | undefined) ?? (client.last_name as string | null);
      const enriched = enrichNamesFromFull(
        midText ? firstNameWithMiddle(curFirst ?? "", midText) : curFirst,
        curLast,
        fullText,
      );
      if (enriched.first_name && enriched.first_name !== client.first_name) {
        update.first_name = enriched.first_name;
        if (!autofilled.includes("first_name")) autofilled.push("first_name");
      }
      if (enriched.last_name && !client.last_name && !update.last_name) {
        update.last_name = enriched.last_name;
        autofilled.push("last_name");
      }
    }
  }
  setScalarDate("date_of_birth", "dob");
  setScalarDate("date_of_birth", "date_of_birth");
  setScalarText("medicaid_id", "medicaid_id");
  setScalarText("phone_number", "phone");
  setScalarText("physical_address", "physical_address");

  const isOwn = byKey.get("is_own_guardian");
  const isOwnVal = isOwn ? fieldBool(isOwn) : null;
  if (isOwnVal === true) {
    if (client.is_own_guardian !== true) {
      update.is_own_guardian = true;
      autofilled.push("is_own_guardian");
    }
  } else {
    if (isOwnVal === false && client.is_own_guardian !== false) {
      update.is_own_guardian = false;
      autofilled.push("is_own_guardian");
    }
  }

  // Contacts (guardian, emergency, support coordinator, doctors) are merged
  // into client_contacts below, after the code rows are classified.
  const flatContacts: Record<string, string | null> = {};
  for (const [key, target] of Object.entries(LEGACY_CONTACT_KEYS)) {
    if (isOwnVal === true && target.role === "guardian") continue;
    const f = byKey.get(key);
    if (f) flatContacts[key] = fieldText(f);
  }

  setScalarText("special_directions", LEGACY_ALERT_KEY);
  if (!update.special_directions) setScalarText("special_directions", "special_directions");
  setScalarBool("dysphagia", "dysphagia");

  const allergiesF = byKey.get("allergies");
  if (allergiesF) mergeArrayColumn("allergies", fieldArray(allergiesF) ?? []);
  const swallowF = byKey.get("swallowing_alerts");
  if (swallowF) mergeArrayColumn("swallowing_alerts", fieldArray(swallowF) ?? []);
  // Diet and mobility land in the Health tab's columns (adaptive equipment
  // joins mobility).
  const dietF = byKey.get("dietary_restrictions");
  if (dietF) mergeArrayColumn("diets", fieldArray(dietF) ?? []);
  mergeArrayColumn(
    "mobility",
    ["mobility_notes", "adaptive_equipment"].flatMap((k) => {
      const f = byKey.get(k);
      return f ? (fieldArray(f) ?? []) : [];
    }),
  );

  const goals = ok
    .filter((f) => f.field_key === "pcsp_goal")
    .map((f) => fieldText(f))
    .filter((s): s is string => !!s);

  // Medical / compliance
  setScalarText("bsp_status", "bsp_status");
  setScalarText("insurance", LEGACY_SINGLE_SOURCE_KEYS.insurance);
  setScalarText("housing_voucher", "housing_voucher");
  // About me ← preferred activities / living (only fills an empty About me).
  {
    const activities = byKey.get(LEGACY_SINGLE_SOURCE_KEYS.activities);
    const living = byKey.get(LEGACY_SINGLE_SOURCE_KEYS.living);
    const aboutMe = singleSourcesFromLegacy({
      preferred_activities: activities ? fieldArray(activities) : null,
      preferred_living: living ? fieldText(living) : null,
    }).about_me;
    const cur = (client as Record<string, unknown>).about_me as string | null;
    if (aboutMe && !cur?.trim()) {
      update.about_me = aboutMe;
      autofilled.push("about_me");
    } else if (aboutMe && cur !== aboutMe) {
      suggested.push("about_me");
      void writeScalarConflict("about_me", cur, aboutMe);
    }
  }
  setScalarText("plan_year", "plan_year");
  setScalarText("disability_category", "disability_category");
  setScalarText("staff_ratio", "staff_ratio");
  setScalarDate("pcsp_expiration_date", "pcsp_expiration_date");


  // End-of-life / advanced care — extractor maps real document wording onto
  // these columns. Status values stay as-extracted (e.g. "Active", "On file");
  // the EOL UI normalizes "none" vs anything-else.
  setScalarText("dnr_status", "dnr_status");
  setScalarText("dnr_location", "dnr_location");
  setScalarText("polst_status", "polst_status");
  setScalarText("palliative_care_status", "palliative_care_status");
  setScalarText("hospice_status", "hospice_status");

  // Booleans
  setScalarBool("has_abi", "has_abi");
  setScalarBool("hr_applicable", "hr_applicable");
  setScalarBool("dnr_applicable", "dnr_applicable");
  setScalarBool("advanced_directives", "advanced_directives");
  setScalarBool("emergency_medical_treatment_authorization", "emergency_medical_treatment_authorization");
  setScalarBool("grievance_acknowledged", "grievance_acknowledged");
  setScalarDate("grievance_signed_date", "grievance_signed_date");

  // Array columns
  const diagnosesF = byKey.get("diagnoses");
  if (diagnosesF) mergeArrayColumn("diagnoses", fieldArray(diagnosesF) ?? []);
  const chronicF = byKey.get("chronic_conditions");
  if (chronicF) mergeArrayColumn("chronic_conditions", fieldArray(chronicF) ?? []);
  const immunF = byKey.get("immunizations");
  if (immunF) mergeArrayColumn("immunizations", fieldArray(immunF) ?? []);
  const courtF = byKey.get("court_orders");
  if (courtF) mergeArrayColumn("court_orders", fieldArray(courtF) ?? []);
  const rightsF = byKey.get("rights_restrictions");
  if (rightsF) mergeArrayColumn("rights_restrictions", fieldArray(rightsF) ?? []);
  const roommatesF = byKey.get("roommates");
  if (roommatesF) mergeArrayColumn("roommates", fieldArray(roommatesF) ?? []);
  const belongingsF = byKey.get("personal_belongings_inventory");
  if (belongingsF) mergeArrayColumn("personal_belongings_inventory", fieldArray(belongingsF) ?? []);

  // SOW §1.10 required dates
  setScalarDate("admission_date", "admission_date");
  setScalarDate("discharge_date", "discharge_date");

  // 1056 (DSPD Service Authorization Form) — header fields.
  setScalarText("form_1056_number", "form_1056_number");
  setScalarDate("form_1056_approved_date", "form_1056_approved_date");

  const externalProviders = await applyImportedCodes(run, ctx);


  // ── Contacts → client_contacts (fill gaps, never overwrite; conflicts flagged) ──
  {
    const incoming = legacyContactsForClient(flatContacts, [], externalProviders);
    if (incoming.length) {
      try {
        const existing = activeContacts(await loadClientContacts(supabase, [clientId]));
        const plan = planContactMerge(existing, incoming);
        const changed = await applyContactMergePlan(supabase, organizationId, clientId, plan);
        if (changed) autofilled.push(`client_contacts(${changed})`);
        for (const c of plan.conflicts) {
          suggested.push(c.field);
          void writeScalarConflict(c.field, c.existing, c.incoming);
        }
      } catch (err) {
        await onError("client_contacts_merge_error", (err as Error).message);
      }
    }
  }

  // ── PCSP goals → the current plan (new goal text only; blank support with active codes) ──
  if (goals.length) {
    try {
      const codes = (await loadActiveCodesAsService(supabase, [clientId])).get(clientId) ?? [];
      const added = await appendGoalsToCurrentPlan(supabase, { organizationId, clientId, goals, codes });
      if (added) autofilled.push(`client_goals(${added})`);
    } catch (err) {
      await onError("client_goals_merge_error", (err as Error).message);
    }
  }

  await applyImportedMeds(run);


  // Team resolution by name → clients.team_id (non-destructive: only fills if empty).
  const teamF = byKey.get("team_name");
  const teamName = teamF ? fieldText(teamF) : null;
  if (teamName) {
    const cur = (client as Record<string, unknown>).team_id;
    if (cur === null || cur === undefined) {
      const { data: t } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("team_name", teamName)
        .maybeSingle();
      if (t?.id) {
        update.team_id = t.id;
        autofilled.push("team_id");
      } else {
        suggested.push(`team_name (no match for "${teamName}")`);
      }
    }
  }

  if (Object.keys(update).length) {
    const { data: updated, error: uErr } = await supabase
      .from("clients")
      .update(update)
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .select("id");
    if (uErr) throw new Error(uErr.message);
    if (!updated || updated.length === 0)
      throw new Error("Client autofill update returned no rows");
  }

  // ── EVV: geocode the home address when we set/changed it. Replaces a
  // stale pin (city centroid / old address). Never invents coordinates.
  const addressChanged = typeof update.physical_address === "string";
  const addrForGeo =
    (update.physical_address as string | undefined) ??
    (client.physical_address as string | null) ??
    null;
  if (addrForGeo && addrForGeo.trim()) {
    const { data: geoRow } = await supabase
      .from("clients")
      .select("home_latitude, home_longitude")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    try {
      const { syncHomePinFromAddress } = await import("@/lib/clients/evv/home-pin");
      const pin = await syncHomePinFromAddress(supabase, {
        clientId,
        organizationId,
        address: addrForGeo,
        mode: addressChanged ? "on_address_save" : "backfill",
        existingLat: geoRow?.home_latitude ?? null,
        existingLng: geoRow?.home_longitude ?? null,
      });
      if (pin.updated) {
        autofilled.push("home_latitude");
        autofilled.push("home_longitude");
      } else if (!pin.geocoded && (geoRow?.home_latitude == null)) {
        suggested.push("Confirm home location for EVV");
      }
    } catch (err) {
      suggested.push("Confirm home location for EVV");
      await onError("geocode_lookup_error", (err as Error).message);
    }
  }


  // Staff ratio → client_ratios row (one per import, "default" setting).
  const ratioF = byKey.get("staff_ratio");
  const ratioText = ratioF ? fieldText(ratioF) : null;
  if (ratioText) {
    const m = /^\s*(\d+)\s*[:/x]\s*(\d+)\s*$/i.exec(ratioText);
    if (m) {
      const ratio_staff = parseInt(m[1], 10);
      const ratio_clients = parseInt(m[2], 10);
      const today = denverYmd();
      const { error: rErr } = await supabase.from("client_ratios").insert({
        organization_id: organizationId,
        client_id: clientId,
        setting: "default",
        ratio_staff,
        ratio_clients,
        effective_start: today,
      });
      if (rErr) {
        // Used to silently swallow → caused the staff_ratio debugging session.
        suggested.push(`staff_ratio (db error: ${rErr.message})`);
        await onError("client_ratios_insert_error", rErr.message);
      } else {
        autofilled.push(`client_ratios(${ratio_staff}:${ratio_clients})`);
      }
    } else {
      suggested.push(`staff_ratio (unparseable "${ratioText}")`);
      await onError("staff_ratio_unparseable", `"${ratioText}"`);
    }
  }

  await applyImportedCustomFields(run);


  return { autofilled, suggested, customCreated };
}
