import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  requiredSlotStatus,
  slotApplies,
  slotCodeLabel,
  type SlotDef,
  type SlotDocument,
} from "./slots.ts";

// The 10 slots seeded by 20261013221151_nectar_required_policy_slots.sql.
const SLOTS: SlotDef[] = [
  ["personnel_policies", "1.17(a)", "Personnel policies", null],
  ["job_descriptions", "1.17(b)", "Job descriptions", null],
  ["staff_supervisor_duties", "1.18(1)", "Staff and supervisor duties", null],
  ["transportation", "1.18(2),(7)", "Transportation and driving record", "transport"],
  ["grievances", "1.18(3)", "Grievances", null],
  ["emergencies", "1.18(4)", "Emergencies, health decline and death", null],
  ["personal_finances", "1.18(5)", "Personal finances", "finances"],
  ["behavior_supports", "1.18(6)", "Behavior supports (R539-4)", null],
  ["human_rights_plan", "1.21", "Human rights plan", null],
  ["health_medication", "1.23", "Health and medication", null],
].map(([id, code, label, applies_when], i) => ({
  id: id!,
  code: code!,
  label: label!,
  applies_when,
  position: i + 1,
}));

const TODAY = "2026-10-13";
const DEFAULT_TOGGLES = { provides_transportation: true, manages_client_money: false };

function doc(
  id: string,
  slot: string,
  status: string,
  reviewDue: string | null,
  superseded: string | null = null,
): SlotDocument {
  return {
    id,
    title: `Doc ${id}`,
    required_slot: slot,
    library_status: status,
    review_due: reviewDue,
    superseded_by: superseded,
  };
}

const row = (result: ReturnType<typeof requiredSlotStatus>, id: string) =>
  result.rows.find((r) => r.id === id)!;

describe("required policies checklist (Decision 3)", () => {
  it("shows Missing, Draft, Published and Past review", () => {
    const result = requiredSlotStatus(
      SLOTS,
      [
        doc("d1", "job_descriptions", "draft", null),
        doc("d2", "grievances", "published", "2027-06-01"),
        doc("d3", "emergencies", "published", "2026-10-01"),
      ],
      DEFAULT_TOGGLES,
      TODAY,
    );
    assert.equal(row(result, "personnel_policies").status, "missing");
    assert.equal(row(result, "job_descriptions").status, "draft");
    assert.deepEqual(
      { status: row(result, "grievances").status, doc: row(result, "grievances").documentId },
      { status: "published", doc: "d2" },
    );
    assert.equal(row(result, "emergencies").status, "past_review");
    assert.equal(result.current, 1, "only the published, current one counts");
  });

  it("uses the best current document and ignores archived and replaced versions", () => {
    const result = requiredSlotStatus(
      SLOTS,
      [
        doc("old", "grievances", "archived", "2027-01-01", "new"),
        doc("new", "grievances", "draft", null),
        doc("pub", "grievances", "published", "2027-01-01"),
        doc("gone", "human_rights_plan", "archived", "2027-01-01"),
      ],
      DEFAULT_TOGGLES,
      TODAY,
    );
    assert.equal(row(result, "grievances").documentId, "pub");
    assert.equal(row(result, "human_rights_plan").status, "missing");
  });

  it("applies the transportation slot only when the agency provides transportation", () => {
    assert.equal(slotApplies(SLOTS[3]!, DEFAULT_TOGGLES), true);
    const noRides = requiredSlotStatus(
      SLOTS,
      [],
      { ...DEFAULT_TOGGLES, provides_transportation: false },
      TODAY,
    );
    assert.equal(row(noRides, "transportation").applies, false);
    assert.equal(noRides.required, 8);
  });

  it("applies the personal finances slot only when the agency manages clients' money", () => {
    const base = requiredSlotStatus(SLOTS, [], DEFAULT_TOGGLES, TODAY);
    assert.equal(row(base, "personal_finances").applies, false);
    assert.equal(base.required, 9);
    const money = requiredSlotStatus(
      SLOTS,
      [],
      { ...DEFAULT_TOGGLES, manages_client_money: true },
      TODAY,
    );
    assert.equal(row(money, "personal_finances").applies, true);
    assert.equal(money.required, 10);
  });

  it("counts X of Y over the slots that apply, in slot order", () => {
    const docs = SLOTS.map((s, i) => doc(`d${i}`, s.id, "published", "2027-01-01"));
    const result = requiredSlotStatus(SLOTS, docs, DEFAULT_TOGGLES, TODAY);
    assert.deepEqual(
      { current: result.current, required: result.required },
      { current: 9, required: 9 },
    );
    assert.deepEqual(
      result.rows.map((r) => r.id),
      SLOTS.map((s) => s.id),
    );
    assert.equal(slotCodeLabel("1.17(a)"), "§1.17(a)");
  });
});
