import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenceFileRow } from "../evidence/types.ts";
import {
  ANNUAL_TRAINING_KEY,
  TRAINING_HOURS_NOTE,
  buildMemberOverview,
  denverWeek,
  evidenceAttention,
  evidenceRows,
  fileBadgeCount,
  noteAttention,
  thisWeek,
  timesheetNoteProblem,
  type OverviewEvidenceItem,
  type OverviewTimesheet,
} from "./overview.ts";

// Wednesday. Denver week = Mon 2026-09-28 … Sun 2026-10-04.
const TODAY = "2026-09-30";
const NOW = new Date("2026-09-30T18:00:00Z");
const STAFF = "staff-1";
const GOOD_NOTE =
  "Supported Tommy with meal prep and a community walk; he chose the route and practiced crossing safely.";

function item(key: string, over: Partial<OverviewEvidenceItem> = {}): OverviewEvidenceItem {
  return {
    id: `item-${key}`,
    organization_id: "org",
    subject_type: "staff",
    subject_id: STAFF,
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
  } as OverviewEvidenceItem;
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
    review_status: "accepted",
    ...over,
  };
}

function ts(id: string, over: Partial<OverviewTimesheet> = {}): OverviewTimesheet {
  return {
    id,
    client_id: "client-1",
    service_type_code: "SLN",
    clock_in_timestamp: "2026-09-29T15:00:00Z",
    clock_out_timestamp: "2026-09-29T19:00:00Z",
    review_status: null,
    status: "Pending",
    shift_note_text: GOOD_NOTE,
    goals_completed: ["goal-1"],
    import_source: null,
    staff_confirmed_at: null,
    is_out_of_bounds: false,
    outside_geofence_reason: null,
    ...over,
  };
}

const NO_NOTES = {
  staffId: STAFF,
  dailyClients: [],
  dailyAssignments: [],
  dailyNotes: [],
  clientNames: { "client-1": "Tommy Jones" },
};

function overview(over: Partial<Parameters<typeof buildMemberOverview>[0]> = {}) {
  return buildMemberOverview({
    today: TODAY,
    now: NOW,
    items: [],
    files: [],
    timesheets: [],
    usesTimesheets: true,
    usesNotes: true,
    ...NO_NOTES,
    ...over,
  });
}

describe("overview — evidence", () => {
  it("no pack: noPack, nothing to attend to, no badge, no training item", () => {
    const o = overview();
    assert.equal(o.readyToWork.noPack, true);
    assert.deepEqual(o.readyToWork.items, []);
    assert.deepEqual(o.attention, []);
    assert.equal(o.fileBadgeCount, 0);
    assert.equal(o.training.item, null);
    assert.equal(o.training.note, TRAINING_HOURS_NOTE);
    assert.deepEqual(o.comingUp, []);
  });

  it("expired item on file is bad attention and counts on the badge", () => {
    const items = [item("cpr_first_aid", { title: "CPR", next_due_on: "2026-09-20" })];
    const files = [file("cpr_first_aid")];
    const o = overview({ items, files });
    assert.equal(o.attention.length, 1);
    assert.equal(o.attention[0]!.kind, "evidence_missing");
    assert.equal(o.attention[0]!.tone, "bad");
    assert.match(o.attention[0]!.detail, /Expired 10 days ago/);
    assert.equal(o.attention[0]!.href, `/dashboard/team-members/${STAFF}?tab=file`);
    assert.equal(o.fileBadgeCount, 1);
    assert.equal(o.readyToWork.items[0]!.status, "missing");
  });

  it("pending upload is NOT done: awaiting review, never complete", () => {
    const items = [item("oig_exclusion", { title: "OIG" })];
    const files = [file("oig_exclusion", { review_status: "pending" })];
    const o = overview({ items, files });
    assert.equal(o.readyToWork.items[0]!.status, "awaiting_review");
    assert.notEqual(o.readyToWork.items[0]!.status, "complete");
    assert.equal(o.attention[0]!.kind, "evidence_review");
    assert.equal(o.fileBadgeCount, 1);
  });

  it("skipped item never counts as missing", () => {
    const items = [
      item("driver_license", { opted_out_at: "2026-09-01T00:00:00Z", first_due_on: "2026-09-01" }),
    ];
    const o = overview({ items });
    assert.deepEqual(o.attention, []);
    assert.equal(o.fileBadgeCount, 0);
    assert.deepEqual(o.comingUp, []);
    assert.equal(o.readyToWork.items[0]!.status, "skipped");
  });

  it("expiring within 30 days is warn; due within 14 is warn; later due is only Coming up", () => {
    const items = [
      item("a", { title: "Renewing", next_due_on: "2026-10-20" }),
      item("b", { title: "Due soon", first_due_on: "2026-10-10" }),
      item("c", { title: "Due later", first_due_on: "2026-11-15" }),
      item("d", { title: "Done far", next_due_on: "2027-09-01" }),
    ];
    const files = [file("a"), file("d")];
    const rows = evidenceRows(items, files, TODAY);
    const att = evidenceAttention(rows, TODAY, "/f");
    assert.deepEqual(
      att.map((a) => [a.title, a.kind, a.tone]),
      [
        ["Renewing", "evidence_expiring", "warn"],
        ["Due soon", "evidence_due", "warn"],
      ],
    );
    // Roster's due-soon window is 30 days; "Due later" is roster-missing (not on file).
    assert.equal(fileBadgeCount(rows, TODAY), 3);
    const o = overview({ items, files });
    assert.deepEqual(
      o.comingUp.map((c) => [c.title, c.date, c.label]),
      [
        ["Due soon", "2026-10-10", "Due"],
        ["Renewing", "2026-10-20", "Renews"],
        ["Due later", "2026-11-15", "Due"],
      ],
    );
  });

  it("annual training reports its Evidence status only", () => {
    const items = [item(ANNUAL_TRAINING_KEY, { title: "Annual 12-hour training" })];
    const o = overview({ items });
    assert.equal(o.training.item?.title, "Annual 12-hour training");
    assert.equal(o.training.item?.status, "add");
  });
});

describe("overview — this week", () => {
  it("Denver Monday–Sunday week", () => {
    assert.deepEqual(denverWeek(TODAY), {
      start: "2026-09-28",
      end: "2026-10-04",
      days: [
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
      ],
    });
    assert.equal(denverWeek("2026-09-28").start, "2026-09-28");
    assert.equal(denverWeek("2026-10-04").start, "2026-09-28");
  });

  it("week boundary uses Denver time, not UTC", () => {
    const w = thisWeek({
      ...NO_NOTES,
      today: TODAY,
      now: NOW,
      usesTimesheets: true,
      usesNotes: true,
      timesheets: [
        // Sun 9/27 11:30 PM Denver (Mon 05:30 UTC) → last week.
        ts("sun", {
          clock_in_timestamp: "2026-09-28T05:30:00Z",
          clock_out_timestamp: "2026-09-28T07:30:00Z",
        }),
        // Mon 9/28 12:30 AM Denver → this week, 2h.
        ts("mon", {
          clock_in_timestamp: "2026-09-28T06:30:00Z",
          clock_out_timestamp: "2026-09-28T08:30:00Z",
        }),
      ],
    });
    assert.equal(w.hours?.clocked, 2);
    assert.equal(w.hours?.byDay[0]!.hours, 2);
    assert.equal(w.notes?.needed, 1);
  });

  it("open punch is excluded from hours and counted as still clocked in", () => {
    const w = thisWeek({
      ...NO_NOTES,
      today: TODAY,
      now: NOW,
      usesTimesheets: true,
      usesNotes: true,
      timesheets: [
        ts("closed"),
        ts("open", { clock_in_timestamp: "2026-09-30T14:00:00Z", clock_out_timestamp: null }),
      ],
    });
    assert.equal(w.hours?.clocked, 4);
    assert.equal(w.hours?.stillClockedIn, 1);
    assert.equal(w.notes?.needed, 1);
    assert.equal(w.overtimeHours, 0);
  });

  it("overtime is hours over 40", () => {
    const long = (id: string, day: string) =>
      ts(id, {
        clock_in_timestamp: `${day}T14:00:00Z`,
        clock_out_timestamp: `${day}T23:00:00Z`,
      });
    const w = thisWeek({
      ...NO_NOTES,
      today: "2026-10-04",
      now: new Date("2026-10-04T23:59:00Z"),
      usesTimesheets: true,
      usesNotes: true,
      timesheets: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"].map((d) =>
        long(d, d),
      ),
    });
    assert.equal(w.hours?.clocked, 45);
    assert.equal(w.overtimeHours, 5);
  });

  it("no timesheets or notes in the agency → null stats with a reason, never 0", () => {
    const w = thisWeek({
      ...NO_NOTES,
      today: TODAY,
      now: NOW,
      usesTimesheets: false,
      usesNotes: false,
      timesheets: [],
    });
    assert.equal(w.hours, null);
    assert.equal(w.notes, null);
    assert.equal(w.overtimeHours, null);
    assert.ok(w.reasons.hours);
    assert.ok(w.reasons.notes);
  });
});

describe("overview — notes", () => {
  it("short note is missing per the review queue; a good note is not", () => {
    assert.equal(timesheetNoteProblem(ts("ok"), NOW), null);
    assert.equal(
      timesheetNoteProblem(ts("short", { shift_note_text: "ok" }), NOW),
      "Missing/short note",
    );
    assert.equal(
      timesheetNoteProblem(ts("goal", { goals_completed: [] }), NOW),
      "PCSP goal not checked",
    );
    // Awaiting staff confirmation → the queue doesn't judge it.
    assert.equal(
      timesheetNoteProblem(
        ts("hist", {
          shift_note_text: "",
          import_source: "historical_import",
          status: "Pending_Staff_Confirmation",
        }),
        NOW,
      ),
      null,
    );
  });

  it("timed shift with a missing note is attention and not submitted", () => {
    const timesheets = [ts("bad", { shift_note_text: "" }), ts("good")];
    const att = noteAttention({ ...NO_NOTES, timesheets, today: TODAY, now: NOW });
    assert.equal(att.length, 1);
    assert.equal(att[0]!.kind, "note_missing");
    assert.match(att[0]!.title, /Tommy Jones/);
    const w = thisWeek({
      ...NO_NOTES,
      timesheets,
      today: TODAY,
      now: NOW,
      usesTimesheets: true,
      usesNotes: true,
    });
    assert.deepEqual(w.notes, { needed: 2, submitted: 1 });
  });

  it("HHS day with a note is submitted; without one it is missing (for the host)", () => {
    const dailyClients = [{ id: "hhs-1", name: "Blake Stevens" }];
    const dailyAssignments = [
      { clientId: "hhs-1", staffId: STAFF, startDate: "2026-01-01", isHost: true },
    ];
    // This week before today: Mon 9/28, Tue 9/29. Note on Monday only.
    const dailyNotes = [{ client_id: "hhs-1", log_date: "2026-09-28", user_id: STAFF }];
    const base = {
      ...NO_NOTES,
      dailyClients,
      dailyAssignments,
      dailyNotes,
      clientNames: {},
      timesheets: [],
    };
    const w = thisWeek({ ...base, today: TODAY, now: NOW, usesTimesheets: false, usesNotes: true });
    assert.deepEqual(w.notes, { needed: 2, submitted: 1 });
    const att = noteAttention({ ...base, timesheets: [], today: TODAY, now: NOW });
    // 14 past days, one with a note → 13 missing, grouped per client.
    assert.equal(att.length, 1);
    assert.equal(att[0]!.kind, "daily_note_missing");
    assert.match(att[0]!.title, /^13 daily notes missing — Blake Stevens/);
    assert.equal(att[0]!.date, "2026-09-29");
    const full = noteAttention({
      ...base,
      timesheets: [],
      dailyNotes: Array.from({ length: 14 }, (_, i) => ({
        client_id: "hhs-1",
        log_date: `2026-09-${String(29 - i).padStart(2, "0")}`,
        user_id: STAFF,
      })),
      today: TODAY,
      now: NOW,
    });
    assert.deepEqual(full, []);
  });

  it("a respite worker on an HHS client owes no daily notes; the host does", () => {
    const dailyClients = [{ id: "hhs-1", name: "Blake Stevens" }];
    const dailyAssignments = [
      { clientId: "hhs-1", staffId: "host-1", startDate: "2026-01-01", isHost: true },
      { clientId: "hhs-1", staffId: STAFF, startDate: "2026-01-01", isHost: false },
    ];
    const base = { ...NO_NOTES, dailyClients, dailyAssignments, clientNames: {}, timesheets: [] };
    const respite = thisWeek({
      ...base,
      today: TODAY,
      now: NOW,
      usesTimesheets: false,
      usesNotes: true,
    });
    assert.deepEqual(respite.notes, { needed: 0, submitted: 0 });
    assert.deepEqual(noteAttention({ ...base, timesheets: [], today: TODAY, now: NOW }), []);
    const host = noteAttention({
      ...base,
      staffId: "host-1",
      timesheets: [],
      today: TODAY,
      now: NOW,
    });
    assert.match(host[0]!.title, /^14 daily notes missing — Blake Stevens/);
    // The respite worker's note covers the host's day too.
    const covered = noteAttention({
      ...base,
      staffId: "host-1",
      dailyNotes: [{ client_id: "hhs-1", log_date: "2026-09-29", user_id: STAFF }],
      timesheets: [],
      today: TODAY,
      now: NOW,
    });
    assert.match(covered[0]!.title, /^13 daily notes missing/);
    assert.equal(covered[0]!.date, "2026-09-28");
  });

  it("attention lists bad before warn", () => {
    const o = overview({
      items: [item("b", { title: "Due soon", first_due_on: "2026-10-03" })],
      timesheets: [ts("bad", { shift_note_text: "" })],
    });
    assert.deepEqual(
      o.attention.map((a) => a.tone),
      ["bad", "warn"],
    );
  });
});
