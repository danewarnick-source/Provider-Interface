import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_CHECKBOX,
  HRR_NECTAR_SYSTEM,
  HRR_QUESTIONS,
  HRR_RULES,
  checkHrrDraft,
  cleanHrrPatch,
  consentNameWarning,
  consentSigner,
  consentStatement,
  dateInDocument,
  hrrPatchSigns,
  hrrSaveError,
  hrrSignatures,
  hrrStatus,
  hrrStatusDetail,
  isHrrDone,
  missingQuestions,
  nameMatches,
  parseHrrDate,
  remainingNectarFields,
  scMethodLabel,
  traceableToDocument,
  type RestrictionRecord,
} from "./hrc.ts";

function rec(over: Partial<RestrictionRecord> = {}): RestrictionRecord {
  return {
    id: "r1",
    organization_id: "o1",
    client_id: "c1",
    restriction_title: "Locked pantry at night",
    active: true,
    assessed_need_text: null,
    positive_interventions_text: null,
    less_intrusive_methods_text: null,
    condition_description_text: null,
    data_review_text: null,
    last_review_date: null,
    time_limits_text: null,
    next_review_date: null,
    restore_plan_text: null,
    no_harm_text: null,
    document_id: null,
    nectar_fields: [],
    consent_signer_name: null,
    consent_signer_role: null,
    consent_client_name: null,
    consent_by: null,
    consent_at: null,
    admin_signer_name: null,
    admin_signed_by: null,
    admin_signed_at: null,
    sc_name: null,
    sc_signed_on: null,
    sc_method: null,
    sc_recorded_by: null,
    sc_recorded_at: null,
    hrc_decision: null,
    hrc_decision_on: null,
    hrc_recorded_by: null,
    hrc_recorded_at: null,
    created_by: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const answered: Partial<RestrictionRecord> = {
  condition_description_text: "Pantry locked 10pm to 6am",
  assessed_need_text: "Night eating risk",
  positive_interventions_text: "Evening snack plan",
  less_intrusive_methods_text: "Door chime",
  data_review_text: "Weekly log reviewed monthly",
  last_review_date: "2026-09-01",
  time_limits_text: "Reviewed every 90 days",
  next_review_date: "2026-12-01",
  no_harm_text: "Food available on request",
};

const signed: Partial<RestrictionRecord> = {
  consent_signer_name: "Pat Example",
  consent_signer_role: "guardian",
  consent_at: "2026-10-02T10:00:00Z",
  admin_signer_name: "Alex Admin",
  admin_signed_at: "2026-10-02T11:00:00Z",
  sc_name: "Sam Coordinator",
  sc_signed_on: "2026-10-03",
  sc_method: "email",
  hrc_decision: "approved",
  hrc_decision_on: "2026-10-04",
};

describe("HRR contract rules", () => {
  it("cites SOW 1.20(b) and the 2:1 rule", () => {
    const cites = HRR_RULES.map((r) => r.cite);
    assert.ok(cites.includes("SOW 1.20(b)"));
    assert.ok(cites.includes("SOW 1.20(b)(7)"));
    assert.ok(cites.includes("SOW 1.33(2)"));
  });
  it("asks every 1.20(b) element except consent as a question; consent is last", () => {
    const cites = HRR_QUESTIONS.map((q) => q.cite).filter(Boolean);
    for (const n of [1, 2, 3, 4, 5, 6, 8])
      assert.ok(cites.includes(`SOW 1.20(b)(${n})`), String(n));
    assert.ok(!cites.includes("SOW 1.20(b)(7)"));
    assert.equal(HRR_QUESTIONS.at(-1)?.field, "no_harm_text");
  });
  it("the restore plan is optional", () => {
    assert.equal(HRR_QUESTIONS.find((q) => q.field === "restore_plan_text")?.required, false);
    assert.equal(missingQuestions(rec(answered)).length, 0);
  });
  it("a question with a date needs the date too", () => {
    const missing = missingQuestions(rec({ ...answered, next_review_date: null }));
    assert.deepEqual(
      missing.map((q) => q.field),
      ["time_limits_text"],
    );
  });
});

describe("hrrStatus", () => {
  it("draft until the questions are answered", () => {
    assert.equal(hrrStatus(rec()), "draft");
    assert.equal(hrrStatusDetail(rec()), "7 questions to answer");
    assert.equal(hrrStatus(rec({ ...signed })), "draft");
  });
  it("awaiting signatures, naming who is missing", () => {
    const r = rec({ ...answered, consent_signer_name: "Pat", consent_at: "2026-10-02T00:00:00Z" });
    assert.equal(hrrStatus(r), "awaiting_signatures");
    assert.equal(
      hrrStatusDetail(r),
      "Waiting on: provider admin, support coordinator, human rights committee",
    );
  });
  it("signed only with consent, admin, SC and HRC approval", () => {
    const r = rec({ ...answered, ...signed });
    assert.equal(hrrStatus(r), "signed");
    assert.ok(isHrrDone(r));
    for (const k of [
      "consent_at",
      "admin_signed_at",
      "sc_signed_on",
      "sc_method",
      "hrc_decision_on",
    ] as const) {
      assert.equal(isHrrDone(rec({ ...answered, ...signed, [k]: null })), false, k);
    }
  });
  it("an HRC denial is its own status and never done", () => {
    const r = rec({ ...answered, ...signed, hrc_decision: "denied" });
    assert.equal(hrrStatus(r), "denied");
    assert.equal(isHrrDone(r), false);
  });
  it("lists the four signers with the guardian label", () => {
    const s = hrrSignatures(rec({ ...answered, ...signed }));
    assert.deepEqual(
      s.map((x) => [x.key, x.label, x.done]),
      [
        ["consent", "Guardian consent", true],
        ["admin", "Provider admin", true],
        ["sc", "Support coordinator", true],
        ["hrc", "Human Rights Committee", true],
      ],
    );
  });
  it("a blank typed name is not a signature", () => {
    const s = hrrSignatures(
      rec({ admin_signer_name: "  ", admin_signed_at: "2026-10-01T00:00:00Z" }),
    );
    assert.equal(s.find((x) => x.key === "admin")?.done, false);
  });
});

describe("consent", () => {
  it("client signs when they are their own guardian", () => {
    assert.deepEqual(consentSigner({ kind: "own" }, "Jo Client"), {
      role: "client",
      label: "Client's full name",
      expectedName: "Jo Client",
    });
  });
  it("guardian signs otherwise; no name on file when missing", () => {
    assert.equal(
      consentSigner({ kind: "on_file", guardian: { name: "Pat G" } }, "Jo").expectedName,
      "Pat G",
    );
    assert.equal(
      consentSigner({ kind: "no_phone", guardian: { name: "Pat G" } }, "Jo").role,
      "guardian",
    );
    assert.equal(consentSigner({ kind: "missing" }, "Jo").expectedName, null);
  });
  it("name match ignores case, punctuation and middle names", () => {
    assert.ok(nameMatches("pat  a. example", "Pat Example"));
    assert.ok(nameMatches("O'Brien, Kim", "Kim OBrien"));
    assert.ok(!nameMatches("Pat Exampel", "Pat Example"));
    assert.ok(nameMatches("anyone", null));
  });
  it("mismatch is a soft warning only", () => {
    const signer = consentSigner({ kind: "on_file", guardian: { name: "Pat Example" } }, "Jo");
    assert.equal(consentNameWarning("Pat Example", signer), null);
    assert.equal(consentNameWarning("", signer), null);
    assert.match(
      consentNameWarning("Chris Other", signer) ?? "",
      /guardian on file \(Pat Example\)/,
    );
  });
  it("statement and checkbox wording", () => {
    assert.equal(
      CONSENT_CHECKBOX,
      "I understand this rights restriction and give my informed consent.",
    );
    assert.match(consentStatement("Jo"), /Human Rights Committee/);
  });
  it("SC method labels", () => {
    assert.equal(scMethodLabel("signed_copy"), "Signed copy uploaded");
    assert.equal(scMethodLabel("fax"), "");
  });
});

const DOC = `Human Rights Restriction
Restriction: The kitchen pantry is locked from 10 PM to 6 AM.
Assessed need: Jo has eaten unsafe amounts of food at night, which led to two ER visits in 2026.
Less restrictive methods tried: a door chime and staff checks every hour did not prevent night eating.
Next review: 12/01/2026. Last reviewed October 1, 2026.`;

describe("Nectar draft validation", () => {
  it("keeps near-verbatim answers", () => {
    assert.ok(traceableToDocument("The kitchen pantry is locked from 10 PM to 6 AM.", DOC));
  });
  it("keeps key-phrase answers that stay close to the document", () => {
    assert.ok(
      traceableToDocument(
        "Jo has eaten unsafe amounts of food at night, leading to two ER visits",
        DOC,
      ),
    );
  });
  it("drops invented or too-short answers", () => {
    assert.ok(!traceableToDocument("Jo is at risk of choking and needs a modified diet.", DOC));
    assert.ok(!traceableToDocument("locked", DOC));
    assert.ok(!traceableToDocument("door chime pantry kitchen staff hourly", DOC));
  });
  it("parses real dates only", () => {
    assert.equal(parseHrrDate("2026-12-01"), "2026-12-01");
    assert.equal(parseHrrDate("12/1/2026"), "2026-12-01");
    assert.equal(parseHrrDate("2026-02-30"), null);
    assert.equal(parseHrrDate("next spring"), null);
    assert.equal(parseHrrDate("1850-01-01"), null);
  });
  it("a date must be written in the document", () => {
    assert.ok(dateInDocument("2026-12-01", DOC));
    assert.ok(dateInDocument("2026-10-01", DOC));
    assert.ok(!dateInDocument("2026-11-01", DOC));
    assert.ok(!dateInDocument("2026-01-01", "Reviewed 11/1/20261"));
  });
  it("checkHrrDraft keeps checked answers, drops the rest, leaves unknown fields blank", () => {
    const reply = JSON.stringify({
      fields: {
        condition_description_text: "The kitchen pantry is locked from 10 PM to 6 AM.",
        assessed_need_text: "Jo needs a weight-loss program and daily weigh-ins.",
        less_intrusive_methods_text:
          "a door chime and staff checks every hour did not prevent night eating",
        next_review_date: "2026-12-01",
        last_review_date: "2026-11-15",
        no_harm_text: "",
        made_up_field: "anything",
      },
    });
    const d = checkHrrDraft("```json\n" + reply + "\n```", DOC);
    assert.deepEqual(d.filled.sort(), [
      "condition_description_text",
      "less_intrusive_methods_text",
      "next_review_date",
    ]);
    assert.deepEqual(d.dropped.sort(), ["assessed_need_text", "last_review_date"]);
    assert.equal(d.values.next_review_date, "2026-12-01");
    assert.equal(d.values.no_harm_text, undefined);
    assert.equal((d.values as Record<string, unknown>).made_up_field, undefined);
  });
  it("bad JSON fills nothing", () => {
    assert.deepEqual(checkHrrDraft("not json", DOC), { values: {}, filled: [], dropped: [] });
  });
  it("the prompt forbids inventing and lists every field", () => {
    assert.match(HRR_NECTAR_SYSTEM, /Never reword, summarize, complete or invent/);
    for (const q of HRR_QUESTIONS) assert.ok(HRR_NECTAR_SYSTEM.includes(q.field));
  });
  it("Nectar marks clear once a person edits or confirms a field", () => {
    assert.deepEqual(
      remainingNectarFields(["assessed_need_text", "no_harm_text", "bogus"], ["no_harm_text"]),
      ["assessed_need_text"],
    );
    assert.deepEqual(remainingNectarFields(null, []), []);
  });
});

describe("saving", () => {
  it("cleans text, dates and choices", () => {
    assert.deepEqual(
      cleanHrrPatch({
        assessed_need_text: "  Night risk  ",
        no_harm_text: "   ",
        next_review_date: "12/1/2026",
        sc_signed_on: "",
        sc_method: "email",
        active: false,
        nectar_fields: ["no_harm_text", "id"],
      }),
      {
        assessed_need_text: "Night risk",
        no_harm_text: null,
        next_review_date: "2026-12-01",
        sc_signed_on: null,
        sc_method: "email",
        active: false,
        nectar_fields: ["no_harm_text"],
      },
    );
  });
  it("refuses stamps, ids, bad dates and unknown choices", () => {
    assert.throws(() => cleanHrrPatch({ admin_signed_by: "u1" }), /can't be changed/);
    assert.throws(() => cleanHrrPatch({ consent_at: "2026-01-01" }), /can't be changed/);
    assert.throws(() => cleanHrrPatch({ client_id: "c2" }), /can't be changed/);
    assert.throws(() => cleanHrrPatch({ next_review_date: "2026-02-31" }), /real date/);
    assert.throws(() => cleanHrrPatch({ sc_method: "fax" }), /Unknown value/);
    assert.throws(() => cleanHrrPatch({ hrc_decision: "maybe" }), /Unknown value/);
    assert.throws(() => cleanHrrPatch({ restriction_title: " " }), /title/);
  });
  it("knows when a save signs", () => {
    assert.ok(hrrPatchSigns({ admin_signer_name: "Alex" }));
    assert.ok(!hrrPatchSigns({ admin_signer_name: null, assessed_need_text: "x" }));
  });
  it("no one signs before every question is answered", () => {
    assert.match(hrrSaveError(rec(), { admin_signer_name: "Alex" }) ?? "", /Answer every question/);
    assert.equal(hrrSaveError(rec(), { assessed_need_text: "x" }), null);
    assert.equal(hrrSaveError(rec(answered), { admin_signer_name: "Alex" }), null);
  });
  it("SC needs a date and method; HRC needs a date", () => {
    assert.match(
      hrrSaveError(rec(answered), { sc_name: "Sam" }) ?? "",
      /support coordinator signed/,
    );
    assert.equal(
      hrrSaveError(rec(answered), {
        sc_name: "Sam",
        sc_signed_on: "2026-10-01",
        sc_method: "in_person",
      }),
      null,
    );
    assert.match(hrrSaveError(rec(answered), { hrc_decision: "approved" }) ?? "", /committee/);
  });
});
