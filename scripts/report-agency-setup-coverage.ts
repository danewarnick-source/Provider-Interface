/**
 * Write the agency-setup question-to-requirement coverage artifact: every
 * one of the 85 docs/compliance/dhhs91172/Applicability_Facts.json rows,
 * how it is answered (agency questionnaire / deferred to a later record /
 * derived / a static rule), and which REQ- keys it feeds.
 * Usage: node --experimental-strip-types scripts/report-agency-setup-coverage.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGENCY_SETUP_QUESTIONS,
  AGENCY_SETUP_QUESTIONS_VERSION,
  AGENCY_SETUP_SECTION_LABELS,
  NON_QUESTION_FACT_DISPOSITIONS,
  workbookFact,
  workbookFactIds,
} from "../src/lib/obligations/agency-setup-questions.ts";
import {
  COMPOUND_SPLIT_FACT_IDS,
  DEFERRED_FACTS,
} from "../src/lib/obligations/deferred-setup-facts.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../docs/compliance/dhhs91172");

type Row = {
  factId: string;
  scope: string;
  disposition: string;
  question: string;
  storage: string;
  requiredness: string;
  consumer: string;
  detail: string;
  requirementCount: number;
  requirementIds: string[];
};

// Columns not read by src/lib/obligations/applicability.ts's loadOrgFacts()
// (the only reader that feeds src/lib/obligations/duty-applicability.ts) as
// of 793c6f8f + this session's changes — verified by direct source
// inspection (grep + reading loadOrgFacts' own SELECT list), not inferred.
// loadOrgFacts selects exactly: fact_operates_ol_site, fact_uses_volunteers,
// fact_has_governing_board, services_offered. If this script starts failing
// its own "verify" step below, either the column was wired in (update this
// set) or it is still a real gap (keep it and update the fact's sourceNote
// to stop implying otherwise).
const AGENCY_COLUMNS_WITH_NO_DUTY_ENGINE_CONSUMER = new Set([
  "fact_provides_respite_overnight",
  "fact_is_usor_vendor",
  "fact_supports_self_administered_medication",
  "fact_acts_as_representative_payee",
  "fact_provides_transportation",
  "sei_award_date", // liveFactKey binding exists (third-executable-batch.ts)
  // but nothing populates it from the real column — see AGENCY_SETUP_COVERAGE_AUDIT.md.
]);

function consumerForAgencyQuestion(storage: {
  kind: "column" | "derived" | "rule";
  table?: string;
  column?: string;
}): string {
  if (storage.kind !== "column" || storage.table !== "organizations") {
    return "N/A (not an organizations column)";
  }
  if (AGENCY_COLUMNS_WITH_NO_DUTY_ENGINE_CONSUMER.has(storage.column!)) {
    return "NONE — stored, but loadOrgFacts() does not select this column; duty-applicability.ts never sees it";
  }
  return "applicability.ts loadOrgFacts() -> OrgFacts -> duty-applicability.ts";
}

function buildRows(): Row[] {
  const rows: Row[] = [];

  for (const q of AGENCY_SETUP_QUESTIONS) {
    for (const factId of q.sourceFactIds) {
      const raw = workbookFact(factId)!;
      const storageText =
        q.storage.kind === "column"
          ? `organizations.${q.storage.column}${q.storage.isNewColumn ? " (new)" : ""}`
          : q.storage.description;
      const requiredness = q.condition
        ? `Conditional — ${q.condition.description}`
        : "Required (agency setup cannot complete without an answer)";
      rows.push({
        factId,
        scope: raw.fact_scope,
        disposition: `Agency questionnaire — "${AGENCY_SETUP_SECTION_LABELS[q.section]}"`,
        question: q.question,
        storage: storageText,
        requiredness,
        consumer: consumerForAgencyQuestion(q.storage),
        detail: q.sourceNote ?? "",
        requirementCount: Number(raw.requirements_affected) || 0,
        requirementIds: raw.linked_requirement_keys
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }
  }

  for (const f of DEFERRED_FACTS) {
    const raw = workbookFact(f.factId)!;
    const storageText =
      f.storage.kind === "generic"
        ? `compliance_fact_answers (scope=${f.storage.scope}) — new field on the ${f.deferredTo.replace("_record", "")} record`
        : f.storage.description;
    const consumer =
      f.storage.kind === "generic"
        ? "NONE — compliance_fact_answers is not read by duty-applicability.ts or load-staff-duty-facts.functions.ts for any scope"
        : "Via the existing mechanism named in Storage — not independently re-verified by this script";
    rows.push({
      factId: f.factId,
      scope: raw.fact_scope,
      disposition: `Deferred to ${f.deferredTo.replace("_record", " record")}`,
      question: f.question,
      storage: storageText,
      requiredness:
        "Not required for agency-setup completion (org_setup_is_complete never reads it); shown " +
        "as an information task on the record once it exists",
      consumer,
      detail: f.sourceNote ?? "",
      requirementCount: Number(raw.requirements_affected) || 0,
      requirementIds: f.sourceRequirementIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  for (const nd of NON_QUESTION_FACT_DISPOSITIONS) {
    const raw = workbookFact(nd.factId)!;
    rows.push({
      factId: nd.factId,
      scope: raw.fact_scope,
      disposition:
        nd.disposition === "derived"
          ? "Derived (no question asked)"
          : "Static platform rule (no question asked)",
      question: raw.question,
      storage: "N/A — not stored, computed or fixed at read time (see Detail)",
      requiredness: "N/A — never asked, so never unanswered",
      consumer: "Via the rule/derivation named in Detail — not independently re-verified by this script",
      detail: nd.detail,
      requirementCount: Number(raw.requirements_affected) || 0,
      requirementIds: raw.linked_requirement_keys
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return rows.sort((a, b) => a.factId.localeCompare(b.factId, undefined, { numeric: true }));
}

function checkExhaustive(rows: Row[]): { missing: string[]; unexpectedDupes: string[] } {
  const all = new Set(workbookFactIds());
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.factId, (counts.get(r.factId) ?? 0) + 1);
  const missing = [...all].filter((id) => !counts.has(id));
  const compound = new Set(COMPOUND_SPLIT_FACT_IDS);
  const unexpectedDupes = [...counts.entries()]
    .filter(([id, n]) => n > 1 && !compound.has(id))
    .map(([id]) => id);
  return { missing, unexpectedDupes };
}

function formatMarkdown(rows: Row[]): string {
  const { missing, unexpectedDupes } = checkExhaustive(rows);
  const totalReqIds = new Set(rows.flatMap((r) => r.requirementIds));
  const lines: string[] = [];
  lines.push("# Agency setup — question-to-requirement coverage");
  lines.push("");
  lines.push(`Registry version: ${AGENCY_SETUP_QUESTIONS_VERSION}.`);
  lines.push(
    `Every row of docs/compliance/dhhs91172/Applicability_Facts.json (${workbookFactIds().length} facts) is accounted for exactly once below (a compound fact split across two rows is the only exception, flagged in its Detail column). Generated by scripts/report-agency-setup-coverage.ts — do not hand-edit.`,
  );
  lines.push("");
  lines.push("## Exhaustiveness check");
  lines.push("");
  lines.push(
    `- Workbook facts with no row below: ${missing.length === 0 ? "none" : missing.join(", ")}`,
  );
  lines.push(
    `- Facts claimed more than once without being a declared compound split: ${unexpectedDupes.length === 0 ? "none" : unexpectedDupes.join(", ")}`,
  );
  lines.push(
    `- Distinct REQ- keys reachable from an agency-level answer or a deferred-record answer: ${totalReqIds.size}`,
  );
  lines.push("");
  lines.push(
    "## Coverage table — fact ID, scope, question/derivation, storage, requiredness, consumer",
  );
  lines.push("");
  lines.push(
    "Consumer is the executable code path that actually reads the stored value back and acts on " +
      'it — not membership in this table, and not "a REQ- key is associated with this fact in the ' +
      'workbook" (that association is the Reqs count/IDs columns, which come from the workbook\'s ' +
      "own linked_requirement_keys and are not proof anything in this codebase evaluates them from " +
      "this fact's value). Verified by direct source inspection where marked; where it says " +
      '"not independently re-verified by this script", the fact has a named mechanism but this '+
      "script did not re-check that mechanism's own callers.",
  );
  lines.push("");
  lines.push(
    "| Fact ID | Workbook scope | How it's answered | Question | Storage | Requiredness | Consumer | Detail | Req count | Req IDs |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |");
  for (const r of rows) {
    const question = r.question.replace(/\|/g, "\\|");
    const detail = (r.detail || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    const storage = r.storage.replace(/\|/g, "\\|");
    const requiredness = r.requiredness.replace(/\|/g, "\\|");
    const consumer = r.consumer.replace(/\|/g, "\\|");
    const reqIds = r.requirementIds.join(", ");
    lines.push(
      `| ${r.factId} | ${r.scope} | ${r.disposition} | ${question} | ${storage} | ${requiredness} | ${consumer} | ${detail} | ${r.requirementCount} | ${reqIds} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

// Self-checking, not just asserted: re-reads applicability.ts's actual
// loadOrgFacts() SELECT list every run, so AGENCY_COLUMNS_WITH_NO_DUTY_ENGINE_CONSUMER
// cannot silently go stale in either direction (a column gets wired in and
// this script keeps claiming it isn't, or someone edits the excluded-set
// comment without the underlying code actually changing).
function verifyDutyEngineConsumerClaim(): void {
  const appPath = join(here, "../src/lib/obligations/applicability.ts");
  const src = readFileSync(appPath, "utf8");
  const match = src.match(/loadOrgFacts[\s\S]*?\.select\(\s*"([^"]+)"/);
  if (!match) {
    throw new Error(
      "Could not find loadOrgFacts()'s .select(...) call in applicability.ts to verify the " +
        "consumer claim against — update verifyDutyEngineConsumerClaim() if that function moved.",
    );
  }
  const selected = new Set(match[1].split(",").map((s) => s.trim()));
  const wronglyExcluded = [...AGENCY_COLUMNS_WITH_NO_DUTY_ENGINE_CONSUMER].filter((c) =>
    selected.has(c),
  );
  if (wronglyExcluded.length > 0) {
    throw new Error(
      `applicability.ts now selects [${wronglyExcluded.join(", ")}] — loadOrgFacts() was updated ` +
        "to read these. Remove them from AGENCY_COLUMNS_WITH_NO_DUTY_ENGINE_CONSUMER in this script " +
        "(the columns now DO have a duty-engine consumer) and update the affected fact's sourceNote.",
    );
  }
  const expectedPresent = ["fact_operates_ol_site", "fact_uses_volunteers", "fact_has_governing_board"];
  const missingExpected = expectedPresent.filter((c) => !selected.has(c));
  if (missingExpected.length > 0) {
    throw new Error(
      `applicability.ts's loadOrgFacts() no longer selects [${missingExpected.join(", ")}] — this ` +
        "script's consumer claim for those facts is stale in the other direction. Investigate before " +
        "trusting the generated Consumer column.",
    );
  }
}

function main(): void {
  verifyDutyEngineConsumerClaim();
  const rows = buildRows();
  const { missing, unexpectedDupes } = checkExhaustive(rows);
  if (missing.length > 0 || unexpectedDupes.length > 0) {
    throw new Error(
      `Coverage is not exhaustive — missing: [${missing.join(", ")}], unexpected dupes: [${unexpectedDupes.join(", ")}]`,
    );
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "AGENCY_SETUP_COVERAGE.md"), formatMarkdown(rows));
  writeFileSync(join(outDir, "AGENCY_SETUP_COVERAGE.json"), JSON.stringify(rows, null, 2));
  console.log(
    `Wrote coverage for ${rows.length} rows (${workbookFactIds().length} workbook facts).`,
  );
}

main();
