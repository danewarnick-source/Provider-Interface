// Client autofill, medications: extracted medications become client_medications
// rows, and a PCSP that says "no medications" turns MAR off.
import { howTakenFromImport, scheduledTimesFromImport } from "@/lib/medications/import-map";
import { supportLevelForHowTaken } from "@/lib/medications/med-rules";
import { type ImportRun, asString, boolFromAny, fieldBool, fieldText } from "./import-fields";

/**
 * Extracted medications → client_medications (skipping ones already on file),
 * and the PCSP's "no medications" turns MAR off for a client with none.
 */
export async function applyImportedMeds(run: ImportRun): Promise<void> {
  const { supabase, organizationId, clientId, ok, byKey, autofilled, suggested, onError } = run;

  // ── Medications signal → auto-toggle MAR/eMAR ───────────────────────────
  // The PCSP is authoritative on whether the client has prescribed meds.
  // - If the document explicitly says "no medications" (pcsp_has_medications=false)
  //   AND no client_medication rows were extracted, turn the feature OFF.
  // - If any medication was extracted, leave the feature ON (default).
  // Skips clients that already have client_medications rows on file, so we
  // never disable MAR for a client who actually has meds tracked elsewhere.
  try {
    const medRows = ok.filter((f) => f.field_key === "client_medication");
    const hasMedsFlag = (() => {
      const f = byKey.get("pcsp_has_medications");
      return f ? fieldBool(f) : null;
    })();
    const { count: existingMedCount } = await supabase
      .from("client_medications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .eq("is_active", true);
    const hasExistingMeds = (existingMedCount ?? 0) > 0;

    if (medRows.length > 0) {
      const { data: existingMeds } = await supabase
        .from("client_medications")
        .select("medication_name,dosage,is_active")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId);
      const seen = new Set(
        (existingMeds ?? []).map((m: { medication_name: string; dosage: string | null }) =>
          `${(m.medication_name || "").trim().toLowerCase()}|${(m.dosage || "").trim().toLowerCase()}`,
        ),
      );
      let insertedMeds = 0;
      for (const f of medRows) {
        const row = (f.value_json && typeof f.value_json === "object" ? f.value_json : {}) as Record<string, unknown>;
        const name = asString(row.medication_name ?? row.name ?? fieldText(f));
        if (!name) continue;
        const dosage = asString(row.dosage ?? row.dose);
        const key = `${name.toLowerCase()}|${(dosage || "").toLowerCase()}`;
        if (seen.has(key)) continue;
        const scheduledTimes = scheduledTimesFromImport(row);
        const howTaken = howTakenFromImport(row.support_level);
        const instructions = asString(row.instructions) ?? asString(row.support_explanation) ?? asString(row.schedule);
        const supportExplanation = asString(row.support_explanation) ?? instructions ?? "Review medication support instructions from the source document.";
        const { error: medErr } = await supabase.from("client_medications").insert({
          organization_id: organizationId,
          client_id: clientId,
          medication_name: name,
          dosage,
          route: asString(row.route),
          frequency: asString(row.frequency ?? row.schedule),
          scheduled_time: scheduledTimes[0] ?? null,
          scheduled_times: scheduledTimes,
          prescriber: asString(row.prescriber),
          instructions,
          how_taken: howTaken,
          support_level: supportLevelForHowTaken(howTaken),
          support_explanation: supportExplanation,
          is_prn: boolFromAny(row.is_prn),
          prn_instructions: asString(row.prn_instructions),
          purpose: asString(row.purpose),
          adverse_effects: asString(row.adverse_effects),
          choking_risk: boolFromAny(row.choking_risk) ?? false,
          choking_risk_details: asString(row.choking_risk_details),
          is_controlled: boolFromAny(row.is_controlled) ?? false,
          pharmacy: asString(row.pharmacy),
          rx_number: asString(row.rx_number),
          packaging: asString(row.packaging),
          side_effects: asString(row.side_effects),
          contributes_to_swallowing_difficulty: boolFromAny(row.contributes_to_swallowing_difficulty) ?? false,
          is_active: true,
        });
        if (medErr) {
          await onError("client_medication_insert_error", medErr.message);
          suggested.push(`medication ${name} (could not create row)`);
        } else {
          insertedMeds += 1;
          seen.add(key);
        }
      }
      if (insertedMeds) autofilled.push(`client_medications(${insertedMeds})`);
    }

    if (medRows.length === 0 && hasMedsFlag === false && !hasExistingMeds) {
      const { data: cRow } = await supabase
        .from("clients")
        .select("feature_config")
        .eq("id", clientId)
        .maybeSingle();
      const fc = (cRow?.feature_config ?? {}) as Record<string, boolean>;
      if (fc.emar !== false) {
        fc.emar = false;
        await supabase
          .from("clients")
          .update({ feature_config: fc })
          .eq("id", clientId)
          .eq("organization_id", organizationId);
        autofilled.push("feature_config.emar=off (no medications in PCSP)");
      }
    }
  } catch (err) {
    // Non-fatal — auto-toggle is advisory, but never silent: audit it.
    await onError("medications_signal_error", (err as Error).message);
  }
}
