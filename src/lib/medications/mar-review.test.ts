// Tests for the MAR sign-off and month loading (against an in-memory stand-in
// for Supabase), the correction rule, and source checks that every MAR server
// function guards before it touches data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { denverWallToIso } from "../denver-date.ts";
import { loadMarMonth } from "./mar-data.ts";
import {
  correctionAccess,
  fileMarDocument,
  loadReview,
  marMonthFileName,
  marMonthPdfPath,
  reopenMonth,
  saveSignOff,
  signOffProblem,
} from "./mar-review.ts";
import { isClientMedicationFile } from "./med-files.ts";

type Row = Record<string, unknown>;

function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = structuredClone(seed);
  let n = 0;
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Array<(r: Row) => boolean> = [];
    let op: "select" | "insert" | "update" = "select";
    let payload: Row = {};
    const run = () => {
      if (op === "insert") {
        const row = { id: `${table}-${++n}`, ...payload };
        rows.push(row);
        return [row];
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") for (const r of hit) Object.assign(r, payload);
      return hit;
    };
    const q = {
      select: () => q,
      order: () => q,
      insert(p: Row) {
        op = "insert";
        payload = p;
        return q;
      },
      update(p: Row) {
        op = "update";
        payload = p;
        return q;
      },
      eq(k: string, v: unknown) {
        filters.push((r) => r[k] === v);
        return q;
      },
      in(k: string, v: unknown[]) {
        filters.push((r) => v.includes(r[k]));
        return q;
      },
      gte(k: string, v: string) {
        filters.push((r) => Date.parse(String(r[k])) >= Date.parse(v));
        return q;
      },
      lt(k: string, v: string) {
        filters.push((r) => Date.parse(String(r[k])) < Date.parse(v));
        return q;
      },
      single: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: run(), error: null }).then(res),
    };
    return q;
  }
  return { from, tables };
}

const ORG = "11111111-1111-1111-1111-111111111111";
const CLIENT = "22222222-2222-2222-2222-222222222222";
const at = (day: string, h: number) => denverWallToIso(day, h, 0);

describe("correctionAccess", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  it("lets medical editors and the logger within 24 hours add a correction", () => {
    const log = { staff_id: "u1", created_at: "2026-10-01T13:00:00Z" };
    assert.equal(correctionAccess({ log, userId: "u9", canEditMedical: true, now }), "editor");
    assert.equal(correctionAccess({ log, userId: "u1", canEditMedical: false, now }), "logger");
    assert.equal(correctionAccess({ log, userId: "u2", canEditMedical: false, now }), null);
    const old = { staff_id: "u1", created_at: "2026-10-01T11:00:00Z" };
    assert.equal(correctionAccess({ log: old, userId: "u1", canEditMedical: false, now }), null);
  });
});

describe("sign-off rules", () => {
  it("stores the PDF in the client's medication folder", () => {
    const path = marMonthPdfPath(ORG, CLIENT, "2026-09", "abc");
    assert.equal(path, `${ORG}/${CLIENT}/medications/mar-2026-09-abc.pdf`);
    assert.ok(isClientMedicationFile(path, ORG, CLIENT));
    assert.equal(
      marMonthFileName("Ann O'Lee", "September 2026"),
      "MAR-September-2026-Ann-OLee.pdf",
    );
  });

  it("allows sign-off only after the month ends and only once", () => {
    const now = new Date(at("2026-10-01", 9));
    assert.equal(signOffProblem("2026-09", null, now), null);
    assert.match(signOffProblem("2026-10", null, now) ?? "", /after its last day/);
    assert.match(
      signOffProblem("2026-09", { id: "r", status: "signed", pdf_path: null }, now) ?? "",
      /already signed off/,
    );
    assert.equal(
      signOffProblem("2026-09", { id: "r", status: "reopened", pdf_path: null }, now),
      null,
    );
  });

  it("signs, reopens with a reason and signs again, logging each step", async () => {
    const db = fakeDb();
    const now = new Date(at("2026-10-01", 9));
    const base = { orgId: ORG, clientId: CLIENT, month: "2026-09", userId: "u1", now };
    await saveSignOff(db, { ...base, notes: " ok ", pdfPath: "p1", existing: null });
    const review = await loadReview(db, CLIENT, "2026-09");
    assert.equal(review?.status, "signed");
    assert.equal(db.tables.medication_month_reviews[0].month, "2026-09-01");
    assert.equal(db.tables.medication_month_reviews[0].notes, "ok");
    await assert.rejects(reopenMonth(db, { ...base, reason: "  " }), /reason/);
    await reopenMonth(db, { ...base, reason: "Late correction" });
    assert.equal((await loadReview(db, CLIENT, "2026-09"))?.status, "reopened");
    await assert.rejects(reopenMonth(db, { ...base, reason: "again" }), /isn't signed off/);
    await saveSignOff(db, {
      ...base,
      notes: null,
      pdfPath: "p2",
      existing: await loadReview(db, CLIENT, "2026-09"),
    });
    assert.equal(db.tables.medication_month_reviews.length, 1);
    assert.deepEqual(
      db.tables.medication_month_review_events.map((e) => e.action),
      ["sign", "reopen", "sign"],
    );
  });

  it("files the PDF as a mar_month document and supersedes the old one", async () => {
    const db = fakeDb({ client_documents: [{ id: "old", client_id: CLIENT, storage_path: "p1" }] });
    const id = await fileMarDocument(db, {
      orgId: ORG,
      clientId: CLIENT,
      month: "2026-09",
      userId: "u1",
      userName: "Jeff",
      fileName: "MAR.pdf",
      path: "p2",
      bytes: 10,
      replacesPath: "p1",
      now: new Date(),
    });
    const docs = db.tables.client_documents;
    assert.equal(docs[1].document_type, "mar_month");
    assert.equal(docs[1].storage_path, "p2");
    assert.equal(docs[0].superseded_by, id);
  });
});

describe("loadMarMonth", () => {
  it("loads the month's doses, corrections, incidents and staff (two people queries)", async () => {
    const db = fakeDb({
      client_medications: [
        {
          id: "m1",
          client_id: CLIENT,
          medication_name: "Sertraline",
          scheduled_times: ["08:00"],
          start_date: "2026-08-01",
          is_active: true,
        },
      ],
      emar_logs: [
        {
          id: "d1",
          client_id: CLIENT,
          medication_id: "m1",
          scheduled_for: at("2026-09-02", 8),
          status: "administered",
          actual_taken_at: at("2026-09-02", 8),
          staff_id: "s1",
        },
        {
          id: "d0",
          client_id: CLIENT,
          medication_id: "m1",
          scheduled_for: at("2026-08-31", 8),
          status: "administered",
          staff_id: "s1",
        },
      ],
      emar_log_addenda: [
        {
          id: "a1",
          emar_log_id: "d1",
          note: "fix",
          reason: "typo",
          created_at: at("2026-09-02", 9),
        },
      ],
      incident_reports: [
        { id: "i1", organization_id: ORG, emar_log_id: "d1", report_number: "IR-7" },
      ],
      client_medication_changes: [
        {
          id: "c1",
          client_id: CLIENT,
          medication_id: "m1",
          action: "add",
          changed_at: at("2026-08-01", 9),
          changed_by: "s2",
          changes: {},
        },
        {
          id: "c2",
          client_id: CLIENT,
          medication_id: "m1",
          action: "edit",
          changed_at: at("2026-09-05", 9),
          changed_by: "s2",
          changes: {},
        },
      ],
      controlled_med_counts: [
        {
          id: "k1",
          client_id: CLIENT,
          medication_id: "m1",
          emar_log_id: "d1",
          context: "pass",
          counted_value: 10,
          count_after: 9,
          flagged: false,
          staff_id: "s1",
          // Saved past the month's edge; still the dose's count.
          created_at: at("2026-10-01", 1),
        },
      ],
      medication_month_reviews: [],
      profiles: [
        { id: "s1", full_name: "Tara Jones" },
        { id: "s2", full_name: "Ann Admin" },
      ],
      organization_members: [{ organization_id: ORG, user_id: "s1", job_title: "DSP" }],
    });
    const m = await loadMarMonth(db, {
      orgId: ORG,
      clientId: CLIENT,
      month: "2026-09",
      now: new Date(at("2026-09-03", 9)),
    });
    assert.deepEqual(
      m.doses.map((d) => d.id),
      ["d1"],
    );
    assert.deepEqual(
      m.changes.map((c) => c.id),
      ["c2"],
    );
    assert.equal(m.addenda.length, 1);
    assert.deepEqual(
      m.counts.map((c) => [c.emar_log_id, c.counted_value, c.count_after]),
      [["d1", 10, 9]],
    );
    assert.equal(m.incidents.d1, "IR-7");
    assert.deepEqual(m.staff, [
      { id: "s1", full_name: "Tara Jones", title: "DSP", initials: "TJ" },
    ]);
    assert.equal(m.names.s2, "Ann Admin");
    assert.equal(m.grid.summary.given, 1);
    assert.equal(m.review, null);
  });
});

describe("MAR wiring", () => {
  const src = readFileSync(new URL("./mar.functions.ts", import.meta.url), "utf8");
  const fns: Array<[string, string]> = [
    ["getMarMonth", "view_medical"],
    ["printMarMonth", "view_medical"],
    ["signOffMarMonth", "edit_medical"],
    ["reopenMarMonth", "edit_medical"],
  ];

  it("guards every function before it touches data", () => {
    for (const [name, action] of fns) {
      const body = src.slice(src.indexOf(`export const ${name}`)).split("export const ")[1];
      const guard = body.indexOf(`guardClient(context, db, data.clientId, "${action}")`);
      assert.ok(guard > 0, `${name} uses ${action}`);
      assert.ok(guard < body.indexOf("loadMarMonth") || !body.includes("loadMarMonth("), name);
    }
    assert.equal(src.match(/requireSupabaseAuth\]/g)?.length, fns.length);
  });

  it("builds the PDF on the server and stores it in the private bucket", () => {
    const body = src.slice(src.indexOf("export const signOffMarMonth"));
    assert.ok(body.indexOf("signOffProblem") < body.indexOf("renderMarPdf"));
    assert.match(body, /\.from\(MEDICATION_FILE_BUCKET\)\s*\.upload\(path, bytes/);
    assert.match(body, /upsert: false/);
  });

  it("corrections check permission and need a reason", () => {
    const pass = readFileSync(new URL("../emar-pass.functions.ts", import.meta.url), "utf8");
    const body = pass.slice(pass.indexOf("export const addEmarAddendum"));
    assert.match(pass, /reason: z\.string\(\)\.trim\(\)\.min\(3\)/);
    assert.match(body, /action: "edit_medical"/);
    assert.match(body, /correctionAccess\(/);
    assert.match(body, /reason: data\.reason/);
  });

  it("keeps corrections insert-only and signed months locked in the database", () => {
    const dir = new URL("../../../supabase/migrations/", import.meta.url);
    const read = (suffix: string) => {
      const f = readdirSync(dir).find((x) => x.endsWith(suffix));
      assert.ok(f, suffix);
      return readFileSync(new URL(f, dir), "utf8");
    };
    const add = read("_meds_m3_addendum_rules.sql");
    assert.match(add, /before update or delete on public\.emar_log_addenda/);
    assert.match(add, /interval '24 hours'/);
    const lock = read("_meds_m3_month_review_lock.sql");
    assert.match(lock, /before update or delete on public\.medication_month_reviews/);
    assert.match(lock, /reopen_reason/);
  });
});
