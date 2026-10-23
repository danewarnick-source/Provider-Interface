// Tests for the medication server functions: the write logic they delegate
// to (meds-write.ts and meds-actions.ts, against an in-memory stand-in for Supabase) and source
// checks that every function guards before it touches the service client.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MedicationValidationError,
  listMedications,
  medicationDiff,
  saveMedicationRow,
} from "./meds-write.ts";
import { listChanges, sendMedicationRow, setMedicationStatusRow } from "./meds-actions.ts";

type Row = Record<string, unknown>;

function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = structuredClone(seed);
  let n = 0;
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Array<[string, unknown]> = [];
    let op: "select" | "insert" | "update" = "select";
    let payload: Row = {};
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (op === "insert") {
        const row = { id: `${table}-${++n}`, ...payload };
        rows.push(row);
        return { data: [row], error: null };
      }
      if (op === "update") {
        const hit = match();
        for (const r of hit) Object.assign(r, payload);
        return { data: hit, error: null };
      }
      return { data: match(), error: null };
    };
    const q = {
      select() {
        return q;
      },
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
        filters.push([k, v]);
        return q;
      },
      order() {
        return q;
      },
      single() {
        const r = run();
        return Promise.resolve({ data: r.data[0] ?? null, error: null });
      },
      maybeSingle() {
        const r = run();
        return Promise.resolve({ data: r.data[0] ?? null, error: null });
      },
      then(res: (v: unknown) => unknown) {
        return Promise.resolve(run()).then(res);
      },
    };
    return q;
  }
  return { from, tables };
}

const scope = { organizationId: "org", clientId: "c1", userId: "u1" };
const complete = {
  medication_name: "Sertraline",
  dosage: "50 mg",
  route: "oral",
  scheduled_times: ["08:00", "20:00"],
  purpose: "Depression",
  side_effects: "Upset stomach",
  adverse_effects: "Self-harm thoughts",
  choking_risk: false,
  how_taken: "assist" as const,
  packaging: "dose pack",
  prescriber: "Dr. Lee",
  start_date: "2026-10-01",
};

describe("saveMedicationRow", () => {
  it("adds a medication, syncs the legacy columns and logs an 'add' change", async () => {
    const db = fakeDb();
    const { id, changes } = await saveMedicationRow(db, { ...scope, input: complete });
    const med = db.tables.client_medications[0];
    assert.equal(med.id, id);
    assert.equal(med.organization_id, "org");
    assert.equal(med.support_level, "staff_administered");
    assert.equal(med.scheduled_time, "08:00");
    assert.deepEqual(changes.medication_name, { from: null, to: "Sertraline" });
    const log = db.tables.client_medication_changes[0];
    assert.equal(log.action, "add");
    assert.equal(log.changed_by, "u1");
  });

  it("refuses to save without the contract-required fields", async () => {
    const db = fakeDb();
    await assert.rejects(
      saveMedicationRow(db, { ...scope, input: { ...complete, route: "" } }),
      (e: unknown) => e instanceof MedicationValidationError && e.issues[0].field === "route",
    );
    assert.equal(db.tables.client_medications?.length ?? 0, 0);
  });

  it("only links this client's files, plan and rights restriction", async () => {
    const db = fakeDb({
      client_documents: [{ id: "bsp1", organization_id: "org", client_id: "c1" }],
      hrc_restriction_records: [{ id: "hrr-other", organization_id: "org", client_id: "c2" }],
    });
    await assert.rejects(
      saveMedicationRow(db, {
        ...scope,
        input: { ...complete, label_photo_path: "org/c2/medications/x.jpg" },
      }),
      /medication files/,
    );
    await assert.rejects(
      saveMedicationRow(db, { ...scope, input: { ...complete, hrc_restriction_id: "hrr-other" } }),
      /isn't on this client's record/,
    );
    const ok = await saveMedicationRow(db, {
      ...scope,
      input: {
        ...complete,
        bsp_document_id: "bsp1",
        label_photo_path: "org/c1/medications/label-x.jpg",
      },
    });
    assert.ok(ok.id);
  });

  it("edits with a field diff, keeps support_level when it already matches, and skips no-op saves", async () => {
    const db = fakeDb({
      client_medications: [
        {
          id: "m1",
          organization_id: "org",
          client_id: "c1",
          is_active: true,
          discontinued_at: null,
          paused_at: null,
          ...complete,
          how_taken: "nurse",
          support_level: "lpn",
        },
      ],
    });
    const r = await saveMedicationRow(db, {
      ...scope,
      id: "m1",
      input: { dosage: "100 mg", how_taken: "nurse" },
    });
    assert.deepEqual(r.changes, { dosage: { from: "50 mg", to: "100 mg" } });
    assert.equal(db.tables.client_medications[0].support_level, "lpn");
    assert.equal(db.tables.client_medication_changes.length, 1);
    await saveMedicationRow(db, { ...scope, id: "m1", input: { dosage: "100 mg" } });
    assert.equal(db.tables.client_medication_changes.length, 1);
  });

  it("won't edit another client's medication", async () => {
    const db = fakeDb({
      client_medications: [{ id: "m1", organization_id: "org", client_id: "c2", ...complete }],
    });
    await assert.rejects(
      saveMedicationRow(db, { ...scope, id: "m1", input: { dosage: "1 mg" } }),
      /not found/,
    );
  });
});

describe("setMedicationStatusRow", () => {
  const seed = () =>
    fakeDb({
      client_medications: [
        {
          id: "m1",
          organization_id: "org",
          client_id: "c1",
          is_active: true,
          discontinued_at: null,
          paused_at: null,
          ...complete,
        },
      ],
    });
  const now = new Date("2026-10-13T12:00:00Z");

  it("pauses and resumes with a reason, logging each change", async () => {
    const db = seed();
    await assert.rejects(
      setMedicationStatusRow(db, { userId: "u1", id: "m1", action: "pause" }),
      /reason/,
    );
    await setMedicationStatusRow(db, {
      userId: "u1",
      id: "m1",
      action: "pause",
      reason: "Hospital",
      now,
    });
    assert.equal(db.tables.client_medications[0].paused_at, now.toISOString());
    await setMedicationStatusRow(db, { userId: "u1", id: "m1", action: "resume" });
    assert.equal(db.tables.client_medications[0].paused_at, null);
    assert.deepEqual(
      db.tables.client_medication_changes.map((c) => c.action),
      ["pause", "resume"],
    );
  });

  it("stops without deleting, and won't stop twice", async () => {
    const db = seed();
    await setMedicationStatusRow(db, {
      userId: "u1",
      id: "m1",
      action: "stop",
      reason: "Prescriber stopped it",
      now,
    });
    const med = db.tables.client_medications[0];
    assert.equal(med.is_active, false);
    assert.equal(med.discontinued_by, "u1");
    assert.equal(med.stop_reason, "Prescriber stopped it");
    await assert.rejects(
      setMedicationStatusRow(db, { userId: "u1", id: "m1", action: "stop", reason: "x" }),
      /already/,
    );
  });
});

describe("sendMedicationRow, listMedications and listChanges", () => {
  it("records the transfer and a 'send' change", async () => {
    const db = fakeDb({
      client_medications: [
        { id: "m1", organization_id: "org", client_id: "c1", is_active: true, ...complete },
      ],
    });
    await sendMedicationRow(db, {
      userId: "u1",
      userName: "Pat",
      id: "m1",
      to: "Day program",
      quantity: 5,
      receivedBy: "Sam",
    });
    assert.equal(db.tables.medication_transfers[0].to_location, "Day program");
    assert.equal(db.tables.medication_transfers[0].released_by_staff_id, "u1");
    assert.equal(db.tables.client_medication_changes[0].action, "send");
    assert.equal((await listChanges(db, "m1")).length, 1);
  });

  it("hides stopped medications unless asked", async () => {
    const db = fakeDb({
      client_medications: [
        { id: "a", client_id: "c1", is_active: true },
        { id: "b", client_id: "c1", is_active: false },
      ],
    });
    assert.deepEqual(
      (await listMedications(db, "c1")).map((m) => m.id),
      ["a"],
    );
    assert.equal((await listMedications(db, "c1", { includeStopped: true })).length, 2);
  });

  it("medicationDiff ignores untouched columns and treats blanks as empty", () => {
    assert.deepEqual(
      medicationDiff({ dosage: "1 mg", route: "oral" }, { dosage: "1 mg", purpose: "" }),
      {},
    );
  });
});

describe("meds.functions.ts wiring", () => {
  const src = readFileSync(new URL("./meds.functions.ts", import.meta.url), "utf8");
  const exportsList = [
    "listClientMedications",
    "saveMedication",
    "setMedicationStatus",
    "sendMedicationWithClient",
    "listMedicationChanges",
  ];

  it("exports every function the screens need, each signed-in", () => {
    for (const name of exportsList)
      assert.match(src, new RegExp(`export const ${name} = createServerFn`));
    assert.equal(src.match(/requireSupabaseAuth\]/g)?.length, exportsList.length);
  });

  it("guards each one (view_medical to read, edit_medical to change) before writing", () => {
    for (const name of exportsList) {
      const body = src.slice(src.indexOf(`export const ${name}`)).split("export const ")[1];
      assert.match(body, /assertCanManageClient|guardMedication/, name);
      const action = name.startsWith("list") ? "view_medical" : "edit_medical";
      assert.ok(body.includes(`"${action}"`), `${name} uses ${action}`);
    }
    assert.doesNotMatch(src, /\.delete\(/);
  });
});
