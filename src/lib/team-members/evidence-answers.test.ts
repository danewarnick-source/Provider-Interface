import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { defaultQuestionnaireAnswers, suggestPacks } from "../evidence/catalog.ts";
import {
  answersForPeople,
  positionServiceCodes,
  type CaseloadFacts,
  type EvidencePersonFacts,
} from "./evidence-answers.ts";

const person = (p: Partial<EvidencePersonFacts> = {}): EvidencePersonFacts => ({
  userId: "u1",
  transportsClients: false,
  positions: [],
  ...p,
});

const caseload = (c: Partial<CaseloadFacts> = {}): CaseloadFacts => ({
  clientIds: ["c1"],
  serviceCodes: [],
  hasAbiClient: false,
  hasBehaviorSupportClient: false,
  ...c,
});

const HHP = { key: "hhp", label: "Host Home Provider" };
const DSP = { key: "dsp", label: "Direct Support Professional" };

describe("answersForPeople — no caseload yet", () => {
  it("uses the staff defaults with transport from the profile", () => {
    const base = defaultQuestionnaireAnswers("staff");
    assert.deepEqual(answersForPeople([person({ transportsClients: false })], {}), {
      ...base,
      transportsPeople: false,
    });
    assert.deepEqual(answersForPeople([person({ transportsClients: true })], new Map()), {
      ...base,
      transportsPeople: true,
    });
  });

  it("an empty caseload counts as none", () => {
    const a = answersForPeople([person()], { u1: caseload({ clientIds: [], hasAbiClient: true }) });
    assert.equal(a.worksWithAbi, false);
  });
});

describe("answersForPeople — caseload facts", () => {
  it("unions caseload codes that are staff quiz codes", () => {
    const a = answersForPeople([person()], {
      u1: caseload({ serviceCodes: ["sln", "HHS", "ZZZ", "SLN"] }),
    });
    assert.deepEqual([...a.serviceCodes].sort(), ["HHS", "SLN"]);
  });

  it("ABI and behavior support come from any caseload client", () => {
    const facts = new Map([
      ["u1", caseload({ hasAbiClient: true })],
      ["u2", caseload({ hasBehaviorSupportClient: true })],
    ]);
    const a = answersForPeople([person(), person({ userId: "u2" })], facts);
    assert.equal(a.worksWithAbi, true);
    assert.equal(a.maySupportAggressiveBehavior, true);
    assert.equal(a.includeCompanyCustoms, false);
    assert.equal(a.subject, "staff");
  });
});

describe("Position pre-checks packs", () => {
  it("Host Home Provider → HHS → the host home pack", () => {
    assert.deepEqual(positionServiceCodes([HHP]), ["HHS"]);
    assert.deepEqual(positionServiceCodes([{ key: "x", label: "host home provider" }]), ["HHS"]);
    assert.deepEqual(positionServiceCodes([DSP]), []);
    const a = answersForPeople([person({ positions: [HHP] })], {});
    assert.deepEqual(a.serviceCodes, ["HHS"]);
    assert.ok(suggestPacks(a).some((s) => s.pack.requirementKeys.includes("host_home_cert")));
  });

  it("a batch only gets a Position pack everyone shares", () => {
    const mixed = answersForPeople(
      [person({ positions: [HHP] }), person({ userId: "u2", positions: [DSP] })],
      {},
    );
    assert.deepEqual(mixed.serviceCodes, []);
    const all = answersForPeople(
      [person({ positions: [HHP] }), person({ userId: "u2", positions: [HHP, DSP] })],
      {},
    );
    assert.deepEqual(all.serviceCodes, ["HHS"]);
  });
});

describe("batches (import)", () => {
  it("transport is on only when everyone transports", () => {
    const some = answersForPeople(
      [person({ transportsClients: true }), person({ userId: "u2" })],
      {},
    );
    assert.equal(some.transportsPeople, false);
    const all = answersForPeople(
      [person({ transportsClients: true }), person({ userId: "u2", transportsClients: true })],
      {},
    );
    assert.equal(all.transportsPeople, true);
  });

  it("no people → defaults with transport off", () => {
    assert.equal(answersForPeople([], {}).transportsPeople, false);
  });
});

describe("questionnaire wiring", () => {
  it("takes optional initial answers and keeps SOW opt-out confirmation and due defaults", () => {
    const src = readFileSync(
      new URL("../../components/evidence/evidence-questionnaire.tsx", import.meta.url),
      "utf8",
    );
    assert.match(src, /initialAnswers\?: QuestionnaireAnswers/);
    assert.match(src, /isSowSuggestedKey\(key, answers\)/);
    assert.match(src, /EVIDENCE_UNCHECK_WARNING/);
    assert.match(src, /defaultDueDraft\(subject, def\?\.dueDefault\)/);
    assert.match(src, /optedOutKeys: suggestedKeys\.filter/);
    assert.doesNotMatch(src, /Employee packs/);
  });

  it("the review dialog applies to the chosen people and passes opted-out keys", () => {
    const src = readFileSync(
      new URL("../../components/team-members/add/review-evidence-dialog.tsx", import.meta.url),
      "utf8",
    );
    assert.match(src, /<EvidenceQuestionnaire/);
    assert.match(src, /subject="staff"/);
    assert.match(src, /answersForPeople/);
    assert.match(src, /applyEvidenceRequirements/);
    assert.match(src, /optedOutKeys: args\.optedOutKeys/);
    assert.match(src, /subjectIds,/);
    const fns = readFileSync(new URL("../evidence.functions.ts", import.meta.url), "utf8");
    assert.match(fns, /optedOutKeys: z\.array\(z\.string\(\)\)\.optional\(\)/);
  });
});
