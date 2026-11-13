// B2 done-when, one test each:
// 1. Cards set to Block makes an expired-card assignment refuse.
// 2. Maple's overnight pay set to Sleep rate shows only that override on Maple's settings.
// 3. Maple's pickups set to an approver makes a claim there wait (Needs you, B5).
// 4. Contract (state) rules show no Off choice.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeDb } from "../fake-db.ts";
import { guardShiftRows, ShiftRefusedError } from "../shift-guard.server.ts";
import { SETTING_RULES, strengthChoices } from "../rules-strength.ts";
import { homeDifferences, type AgencySchedulingSettings } from "./settings-model.ts";
import { pickupModeFor } from "./pickup.ts";

const ORG = "00000000-0000-0000-0000-000000000001";
// The agency row as the database creates it (column defaults).
const AGENCY: AgencySchedulingSettings = {
  organization_id: ORG,
  rule_settings: {},
  ot_threshold_hours: 40,
  hours_cap: 50,
  min_rest_hours: 8,
  max_days_in_row: 6,
  max_hours_in_row: 16,
  claim_mode: "first",
  quiet_start: 21,
  quiet_end: 7,
  urgent_hours: 4,
  escalation_waits: [15, 15, 10],
  holdover_ask: true,
  holdover_visible: true,
  workweek_start: 0,
  ot_multiplier: 1.5,
  sleep_rate: 12,
  oncall_stipend: 40,
  night_diff: null,
  night_from: 23,
  night_to: 7,
  weekend_diff: null,
  reminder_minutes: 60,
  digest: true,
  location_at_punch_only: true,
  updated_at: "2026-10-23T00:00:00Z",
  updated_by: null,
};
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("1. Cards set to Block: assigning someone whose CPR expired is refused", async () => {
  const facts = (cards: string) => ({
    clients: [
      {
        id: "client-1",
        first_name: "Test",
        last_name: "Client",
        date_of_birth: "1990-01-01",
        has_abi: false,
        team_id: null,
      },
    ],
    "rpc:client_authorizations_for_rules": [
      {
        client_id: "client-1",
        service_code: "SLH",
        service_start_date: "2026-01-01",
        service_end_date: null,
        authorization_approved_on: null,
        worksheet_weekly_hours: null,
        ratio: null,
      },
    ],
    staff_assignments: [{ client_id: "client-1", staff_id: "staff-1", service_codes: ["SLH"] }],
    profiles: [
      {
        id: "staff-1",
        full_name: "Test Staff",
        date_of_birth: "1990-01-01",
        hire_date: "2020-01-01",
      },
    ],
    organization_members: [{ user_id: "staff-1", active: true }],
    evidence_items: [
      {
        id: "i1",
        subject_id: "staff-1",
        requirement_key: "cpr_first_aid",
        evidence_type: "upload",
        expires_on: "2026-01-31",
      },
      {
        id: "i2",
        subject_id: "staff-1",
        requirement_key: "thirty_day_orientation",
        evidence_type: "upload",
        expires_on: null,
      },
    ],
    evidence_files: [
      {
        id: "f1",
        item_id: "i1",
        review_status: "accepted",
        uploaded_at: "2025-01-01T00:00:00Z",
        filename: "cpr.pdf",
      },
      {
        id: "f2",
        item_id: "i2",
        review_status: "accepted",
        uploaded_at: "2025-01-01T00:00:00Z",
        filename: "orientation.pdf",
      },
    ],
    org_shift_behavior_settings: { ...AGENCY, rule_settings: { card: cards } },
  });
  const row = {
    staff_id: "staff-1",
    client_id: "client-1",
    service_code: "SLH",
    starts_at: "2026-10-14T15:00:00Z",
    ends_at: "2026-10-14T17:00:00Z",
  };
  const warn = await guardShiftRows(fakeDb(facts("warn")).db, ORG, [row]);
  assert.ok(warn.some((w) => /CPR \/ First Aid expired/.test(w)));
  await assert.rejects(
    guardShiftRows(fakeDb(facts("block")).db, ORG, [row]),
    (e: unknown) =>
      e instanceof ShiftRefusedError &&
      /^Test's CPR \/ First Aid expired on 2026-01-31/.test(e.message),
  );
});

test("2. Maple's overnight pay set to Sleep rate is the only line on Maple's settings", () => {
  const rows = homeDifferences(AGENCY, { team_id: "maple", overnight_pay: "sleeprate" });
  assert.deepEqual(rows, [{ label: "Overnight pay", value: `Sleep rate $${AGENCY.sleep_rate}/h` }]);
  assert.deepEqual(homeDifferences(AGENCY, null), []);
});

test("3. Maple's pickups set to an approver: a claim there waits instead of assigning", () => {
  assert.equal(pickupModeFor("first", "lead"), "lead");
  assert.equal(pickupModeFor("first", "owner"), "owner");
  assert.equal(pickupModeFor("first", null), "auto");
  assert.equal(pickupModeFor("approve", null), "lead");
  const claim = read("../open-shifts.functions.ts");
  assert.match(claim, /pickupModeFor\(/);
  assert.match(claim, /if \(mode === "auto"\)[\s\S]*claim_open_shift_first/);
});

test("4. State (contract) rules show no Off choice; the Rules tab only offers strengthChoices", () => {
  for (const r of SETTING_RULES.filter((s) => s.state))
    assert.ok(!strengthChoices(r).includes("off"), r.key);
  assert.match(read("../../../components/scheduler/settings/rules-tab.tsx"), /strengthChoices\(/);
});
