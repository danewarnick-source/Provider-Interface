import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { EvidenceFileRow } from "../evidence/types.ts";
import type { BadgeEvidenceItem } from "./badges.ts";
import {
  isCprQualificationKey,
  isReadyAlone,
  readinessBadge,
  readinessWarnings,
  readyAloneLabel,
  staffClientReadiness,
  type ReadinessInput,
} from "./readiness.ts";

const TODAY = "2026-09-28";

function item(key: string, over: Partial<BadgeEvidenceItem> = {}): BadgeEvidenceItem {
  return {
    id: `item-${key}`,
    organization_id: "org",
    subject_type: "staff",
    subject_id: "staff-1",
    requirement_key: key,
    title: key,
    evidence_type: "upload",
    attestation_text: null,
    cadence: "once",
    sow_cite: null,
    suggested: false,
    sent_to_staff: false,
    visible_to_staff_id: null,
    dual_link_key: null,
    dual_link_peer_id: null,
    expires_on: null,
    first_due_rule: null,
    first_due_on: null,
    document_date: null,
    next_due_on: null,
    renew_years: null,
    send_message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as BadgeEvidenceItem;
}

function file(key: string, over: Partial<EvidenceFileRow> = {}): EvidenceFileRow {
  return {
    id: `file-${key}`,
    organization_id: "org",
    item_id: `item-${key}`,
    storage_path: "org/staff/x.pdf",
    filename: "x.pdf",
    attested_at: null,
    attested_by: null,
    attestation_text_snapshot: null,
    uploaded_by: null,
    uploaded_at: "2026-03-04T15:00:00Z",
    notes: null,
    ...over,
  };
}

/** Evidence rows with an accepted file on each key in `done`. */
function evidence(done: string[], extra: BadgeEvidenceItem[] = []) {
  return {
    items: [...done.map((k) => item(k)), ...extra],
    files: done.map((k) => file(k)),
  };
}

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    today: TODAY,
    hireDate: "2024-01-01",
    evidence: evidence(["thirty_day_orientation", "cpr_first_aid"]),
    client: { hasAbi: false, behaviorSupport: false },
    personTraining: { requiredIds: [], completedIds: [] },
    ...over,
  };
}

describe("staffClientReadiness", () => {
  it("is ready with orientation and CPR on file and no client needs", () => {
    const r = staffClientReadiness(input());
    assert.equal(r.status, "ready");
    assert.deepEqual(r.missing, []);
    assert.deepEqual(r.deadlines, []);
    assert.deepEqual(r.skipped, []);
  });

  it("needs 30-day orientation", () => {
    const r = staffClientReadiness(input({ evidence: evidence(["cpr_first_aid"]) }));
    assert.equal(r.status, "not_ready");
    assert.deepEqual(
      r.missing.map((m) => m.label),
      ["30-day orientation"],
    );
  });

  it("an upload waiting on review is not done", () => {
    const ev = evidence(["thirty_day_orientation", "cpr_first_aid"]);
    ev.files[0] = file("thirty_day_orientation", { review_status: "pending" });
    const r = staffClientReadiness(input({ evidence: ev }));
    assert.deepEqual(
      r.missing.map((m) => m.rule),
      ["orientation"],
    );
  });

  it("needs this client's person-specific training when one is published", () => {
    const missing = staffClientReadiness(
      input({ personTraining: { requiredIds: ["t1", "t2"], completedIds: ["t1"] } }),
    );
    assert.deepEqual(
      missing.missing.map((m) => m.label),
      ["Person-specific training"],
    );
    const done = staffClientReadiness(
      input({ personTraining: { requiredIds: ["t1"], completedIds: new Set(["t1"]) } }),
    );
    assert.equal(done.status, "ready");
  });

  it("ABI client needs ABI training; a non-ABI client doesn't", () => {
    const abi = staffClientReadiness(input({ client: { hasAbi: true, behaviorSupport: false } }));
    assert.deepEqual(
      abi.missing.map((m) => m.label),
      ["ABI training"],
    );
    const ok = staffClientReadiness(
      input({
        client: { hasAbi: true, behaviorSupport: false },
        evidence: evidence(["thirty_day_orientation", "cpr_first_aid", "abi_training"]),
      }),
    );
    assert.equal(ok.status, "ready");
  });

  it("CPR within 90 days of hire is a deadline, after that it's missing", () => {
    const fresh = staffClientReadiness(
      input({ hireDate: "2026-08-01", evidence: evidence(["thirty_day_orientation"]) }),
    );
    assert.equal(fresh.status, "ready_with_deadline");
    assert.deepEqual(fresh.deadlines, [{ rule: "cpr", label: "CPR", dueBy: "2026-10-30" }]);
    const late = staffClientReadiness(
      input({ hireDate: "2026-06-30", evidence: evidence(["thirty_day_orientation"]) }),
    );
    assert.equal(late.status, "not_ready");
    assert.deepEqual(
      late.missing.map((m) => m.label),
      ["CPR"],
    );
  });

  it("no hire date gives no grace", () => {
    const r = staffClientReadiness(
      input({ hireDate: null, evidence: evidence(["thirty_day_orientation"]) }),
    );
    assert.deepEqual(
      r.missing.map((m) => m.rule),
      ["cpr"],
    );
  });

  it("behavior client needs behavior certification, with a 180-day grace", () => {
    const client = { hasAbi: false, behaviorSupport: true };
    const fresh = staffClientReadiness(input({ client, hireDate: "2026-06-01" }));
    assert.equal(fresh.status, "ready_with_deadline");
    assert.deepEqual(fresh.deadlines, [
      { rule: "behavior", label: "Behavior certification", dueBy: "2026-11-28" },
    ]);
    const old = staffClientReadiness(input({ client }));
    assert.deepEqual(
      old.missing.map((m) => m.rule),
      ["behavior"],
    );
    const none = staffClientReadiness(input());
    assert.equal(none.status, "ready");
  });

  it("a skipped item reports skipped by {name}, never missing", () => {
    const ev = evidence(
      ["cpr_first_aid"],
      [
        item("thirty_day_orientation", {
          opted_out_at: "2026-09-01T00:00:00Z",
          opted_out_by: "u9",
        }),
      ],
    );
    const r = staffClientReadiness(
      input({ evidence: ev, nameOf: (id) => (id === "u9" ? "Dane Warnick" : null) }),
    );
    assert.equal(r.status, "ready");
    assert.deepEqual(r.missing, []);
    assert.deepEqual(r.skipped, [
      { rule: "orientation", label: "30-day orientation", skippedBy: "Dane Warnick" },
    ]);
    assert.equal(readinessBadge(r).label, "30-day orientation skipped by Dane Warnick");
  });

  it("lists every missing rule in order", () => {
    const r = staffClientReadiness(
      input({
        hireDate: null,
        evidence: { items: [], files: [] },
        client: { hasAbi: true, behaviorSupport: true },
        personTraining: { requiredIds: ["t1"], completedIds: [] },
      }),
    );
    assert.deepEqual(
      r.missing.map((m) => m.rule),
      ["orientation", "person_training", "abi", "cpr", "behavior"],
    );
  });
});

describe("readiness badges and counts", () => {
  it("Ready / Ready — CPR due by / Not ready", () => {
    assert.deepEqual(readinessBadge(staffClientReadiness(input())), {
      label: "Ready",
      tone: "ok",
    });
    const due = readinessBadge(
      staffClientReadiness(
        input({ hireDate: "2026-08-01", evidence: evidence(["thirty_day_orientation"]) }),
      ),
    );
    assert.equal(due.tone, "warn");
    assert.match(due.label, /^Ready — CPR due by /);
    const not = readinessBadge(staffClientReadiness(input({ evidence: { items: [], files: [] } })));
    assert.deepEqual(not, { label: "Not ready: 30-day orientation, CPR", tone: "bad" });
  });

  it("Ready alone counts ready and ready-with-deadline", () => {
    const ready = staffClientReadiness(input());
    const due = staffClientReadiness(
      input({ hireDate: "2026-08-01", evidence: evidence(["thirty_day_orientation"]) }),
    );
    const not = staffClientReadiness(input({ evidence: { items: [], files: [] } }));
    assert.equal(isReadyAlone(due), true);
    assert.equal(isReadyAlone(not), false);
    assert.equal(readyAloneLabel([ready, due, not]), "Ready alone: 2 of 3 clients");
    assert.equal(readyAloneLabel([ready]), "Ready alone: 1 of 1 client");
    assert.equal(readyAloneLabel([]), null);
  });

  it("scheduler warnings come from the same result", () => {
    const r = staffClientReadiness(
      input({
        hireDate: "2026-08-01",
        evidence: { items: [], files: [] },
        client: { hasAbi: true, behaviorSupport: false },
      }),
    );
    assert.deepEqual(readinessWarnings(r), [
      "Not ready: 30-day orientation, ABI training",
      "CPR due by 2026-10-30",
    ]);
    assert.deepEqual(readinessWarnings(staffClientReadiness(input())), []);
  });

  it("CPR qualification keys are recognized so the scheduler checks CPR once", () => {
    for (const k of [
      "cpr-fa",
      "external_cert:cpr-fa",
      "baseline_training:cpr_first_aid",
      "baseline_training:cpr_first_aid_bbp",
      "hive_course:cpr_first_aid",
    ]) {
      assert.equal(isCprQualificationKey(k), true, k);
    }
    assert.equal(isCprQualificationKey("external_cert:abuse-neglect"), false);
  });
});

describe("one rule set", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

  it("rankStaffForShift scores readiness through staffClientReadiness", () => {
    const fn = read("../scheduling/eligibility.functions.ts");
    assert.match(fn, /staffClientReadiness\(/);
    assert.match(fn, /readinessWarnings\(/);
    assert.match(fn, /isCprQualificationKey/);
    const pure = read("../scheduling/eligibility.ts");
    assert.doesNotMatch(pure, /No client-specific training/);
    assert.doesNotMatch(pure, /completedClientTrainings/);
  });

  it("the caseload loader and tab use the same function", () => {
    assert.match(read("./caseload.functions.ts"), /staffClientReadiness\(/);
    assert.match(
      read("../../components/team-members/profile/caseload-tab.tsx"),
      /staffClientReadiness\(/,
    );
  });
});
