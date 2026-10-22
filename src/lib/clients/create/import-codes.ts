// Client autofill, billing codes: the document's code rows become authorization
// rows (client_billing_codes) for the agency's own codes; the 1056 wins on units.
import { denverYmd } from "@/lib/denver-date";
import { type LegacyExternalService } from "../legacy-fields";
import {
  type ApplyExtractedCtx,
  type ExtractedField,
  type ImportRun,
  fieldDate,
  fieldText,
  toNum,
} from "./import-fields";

/**
 * The document's billing-code rows → client_billing_codes. Only the agency's own
 * codes are written; other providers' lines come back as contacts to merge.
 * PCSP and 1056 may close authorization rows the document no longer lists.
 */
export async function applyImportedCodes(
  run: ImportRun,
  ctx: Pick<ApplyExtractedCtx, "tenant" | "overrides">,
): Promise<LegacyExternalService[]> {
  const {
    supabase,
    organizationId,
    clientId,
    ok,
    byKey,
    sourceDocumentType,
    autofilled,
    suggested,
    writeScalarConflict,
  } = run;
  let externalProviders: LegacyExternalService[] = [];

  // Billing-code rows
  let codeRows: Array<{
    service_code: string;
    rate?: number | null;
    max_units?: number | null;
    monthly_max_units?: number | null;
    unit_type?: string | null;
    weekly_cap_units?: number | null;
    plan_start?: string | null;
    plan_end?: string | null;
    // Captured for prompt 15 (provider scoping). Not yet persisted to a column.
    provider_name?: string | null;
    financial_eligibility?: string | null;
    daily_hours?: number | null;
  }> = [];
  for (const f of ok) {
    if (f.field_key === "billing_code_row" && f.value_json && typeof f.value_json === "object") {
      const row = f.value_json as Record<string, unknown>;
      // Rows the admin explicitly marked "not our organization" are
      // informational-only on the record and MUST NOT flow into billing
      // codes OR into the client's other-provider contacts. Skip entirely.
      if (row.ownership_ack === "not_ours") continue;
      if (row.service_code) {
        codeRows.push({
          service_code: String(row.service_code).toUpperCase(),
          rate: toNum(row.rate),
          max_units: toNum(row.max_units),
          monthly_max_units: toNum(row.monthly_max_units),
          unit_type: row.unit_type ? String(row.unit_type) : null,
          weekly_cap_units: toNum(row.weekly_cap_units),
          plan_start: row.plan_start ? String(row.plan_start).slice(0, 10) : null,
          plan_end: row.plan_end ? String(row.plan_end).slice(0, 10) : null,
          provider_name: row.provider_name ? String(row.provider_name).trim() : null,
          financial_eligibility: row.financial_eligibility ? String(row.financial_eligibility).trim() : null,
          daily_hours: toNum(row.daily_hours),
        });
      }
    }
  }
  if (!codeRows.length) {
    const sc = byKey.get("service_code");
    if (sc && fieldText(sc)) {
      const rateF = byKey.get("rate");
      const maxF = byKey.get("max_units");
      const wcapF = byKey.get("weekly_cap_units");
      const ut = byKey.get("unit_type");
      codeRows.push({
        service_code: (fieldText(sc) as string).toUpperCase(),
        rate: rateF ? toNum(rateF.value_number ?? rateF.value_text) : null,
        max_units: maxF ? toNum(maxF.value_number ?? maxF.value_text) : null,
        unit_type: ut ? fieldText(ut) : null,
        weekly_cap_units: wcapF ? toNum(wcapF.value_number ?? wcapF.value_text) : null,
        plan_start: byKey.get("plan_start") ? fieldDate(byKey.get("plan_start") as ExtractedField) : null,
        plan_end: byKey.get("plan_end") ? fieldDate(byKey.get("plan_end") as ExtractedField) : null,
      });
    }
  }

  if (codeRows.length) {
    // ── Prompt 15: scope to the provider's own awarded codes ────────────────
    // Anything not "ours" is filed as coordination info (or dropped if the
    // admin explicitly chose to ignore). This narrows within the existing
    // authoritative-set gate; it never widens it.
    const { partitionCodeRows } = await import("@/lib/service-classification");
    const tenant = ctx.tenant ?? { codesHeld: [], names: [] };
    const overrides = ctx.overrides ?? {};
    const partition = partitionCodeRows(codeRows, tenant, overrides);

    // External / coordination-only services — kept as "other provider"
    // contacts (merged below), never billed.
    externalProviders = partition.other.map((r) => ({
      provider_name: r.provider_name ?? null,
      service_code: r.service_code,
      note: r._classification.reason ?? null,
    }));
    if (partition.ignored.length) {
      suggested.push(`Ignored ${partition.ignored.length} non-billing line(s) per admin choice.`);
    }
    if (partition.needsReview.length) {
      // Defensive: validator should have blocked this. Surface as gap.
      suggested.push(
        `Skipped (needs owner confirmation): ${partition.needsReview.map((r) => r.service_code).join(", ")}`,
      );
    }

    // Only "ours" rows continue through the billing-codes pipeline.
    codeRows = partition.ours;
  }

  if (codeRows.length) {
    const codes = Array.from(new Set(codeRows.map((r) => r.service_code)));
    // Only PCSP and 1056 are authoritative for the active code SET (they may
    // close stale authorization rows below). Other document types (MAR, BSP,
    // immunization, allergy, end-of-life docs) only add/refresh rows.
    const isAuthoritative =
      sourceDocumentType === null || // legacy callers (no type) keep prior behavior
      sourceDocumentType === "pcsp" ||
      sourceDocumentType === "1056_budget";

    const { isDailyServiceCode } = await import("@/lib/service-billing");

    // Authoritative-source rule for UNITS: the 1056 wins. A PCSP may seed
    // units only when no prior authorization row exists; the 1056 always
    // overwrites annual_unit_authorization for the codes it lists.
    // Pull current rows so we know which (org, client, service_code) exist.
    const { data: existingForUnits } = await supabase
      .from("client_billing_codes")
      .select("service_code, annual_unit_authorization")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId);
    const existingByCode = new Map<string, number | null>(
      ((existingForUnits ?? []) as Array<{ service_code: string; annual_unit_authorization: number | null }>)
        .map((r) => [r.service_code, r.annual_unit_authorization]),
    );

    const stubs = codeRows.map((r) => {
      const prior = existingByCode.get(r.service_code) ?? null;
      let annual: number | null = r.max_units ?? null;
      if (sourceDocumentType === "1056_budget") {
        // 1056 wins for units — always overwrite when it provides a value.
        annual = r.max_units ?? prior ?? 0;
      } else if (sourceDocumentType === "pcsp") {
        // PCSP only fills units when none are on file (or were zero).
        annual = (prior && prior > 0) ? prior : (r.max_units ?? 0);
        if (r.max_units && prior && prior > 0 && r.max_units !== prior) {
          void writeScalarConflict(
            `client_billing_codes.${r.service_code}.annual_unit_authorization`,
            prior,
            r.max_units,
          );
        }
      } else {
        annual = r.max_units ?? prior ?? 0;
      }
      const rate = r.rate ?? 0;
      const annualOut = annual ?? 0;
      // Prompt 18: advisory flag — admin can fill rate/units later when the
      // 1056 lands or the PCSP gets amended. Never blocks commit.
      const pending = !(rate > 0) || !(annualOut > 0);
      return {
        organization_id: organizationId,
        client_id: clientId,
        service_code: r.service_code,
        unit_type: r.unit_type ?? (isDailyServiceCode(r.service_code) ? "day" : "unit"),
        annual_unit_authorization: annualOut,
        monthly_max_units: r.monthly_max_units ?? null,
        rate_per_unit: rate,
        weekly_cap_units: r.weekly_cap_units ?? null,
        service_start_date: r.plan_start ?? null,
        service_end_date: r.plan_end ?? null,
        authorization_pending: pending,
      };
    });
    const { error: bcErr } = await supabase
      .from("client_billing_codes")
      .upsert(stubs, { onConflict: "organization_id,client_id,service_code" });
    if (bcErr) throw new Error(`billing-codes upsert failed: ${bcErr.message}`);
    autofilled.push(`client_billing_codes(${stubs.length})`);

    // Close any existing authorization rows for codes NOT in the new doc.
    // Only authoritative documents (PCSP / 1056) ever close stale rows.
    if (isAuthoritative) {
      const today = denverYmd();
      const { data: existingCodeRows } = await supabase
        .from("client_billing_codes")
        .select("id, service_code, service_end_date")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId);
      const stale = (existingCodeRows ?? []).filter(
        (r: { service_code: string; service_end_date: string | null }) =>
          !codes.includes(r.service_code) &&
          (!r.service_end_date || r.service_end_date > today),
      );
      for (const r of stale) {
        await supabase
          .from("client_billing_codes")
          .update({ service_end_date: today })
          .eq("id", (r as { id: string }).id);
        suggested.push(`Closed stale auth: ${(r as { service_code: string }).service_code}`);
      }
    }
  }

  return externalProviders;
}
