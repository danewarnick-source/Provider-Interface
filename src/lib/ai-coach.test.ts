import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { checkNectarCaller, type NectarCallerDeps } from "./nectar/engine/guard.ts";
import { COACH_RATE_LIMIT_MESSAGE, coachModelFor, type CoachGateway } from "./nectar/engine/coach-model.ts";
import { runAnswerProcedural, validateProcedural } from "./nectar/engine/coach-assist.ts";

const SRC = readFileSync(new URL("./ai-coach.functions.ts", import.meta.url), "utf8");
const PUNCH_PAD = readFileSync(new URL("../components/evv/punch-pad.tsx", import.meta.url), "utf8");

const SERVER_FNS = [
  "evaluateShiftNote",
  "draftShiftNote",
  "answerProceduralQuestion",
  "scanNoteForTriggers",
  "draftIncidentNarrative",
  "reviewIncidentReport",
];

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is still exported`);
  const next = SRC.indexOf("export const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

describe("ai-coach.functions.ts (N1 server guards)", () => {
  it("keeps every exported name, input and output punch-pad and the other screens import", () => {
    for (const name of SERVER_FNS) serverFn(name);
    // N2 removed the one server function nothing called (the geofence variance drafter).
    const exported = [...SRC.matchAll(/^export const (\w+) = createServerFn/gm)].map((m) => m[1]);
    assert.deepEqual(exported, SERVER_FNS);
    for (const type of ["CoachResult", "ScanResult", "ProceduralResult", "DraftResult", "IncidentReviewResult"]) {
      assert.match(SRC, new RegExp(`\\b${type}\\b[^;]*from "@/lib/nectar/engine/coach-`), type);
    }
    assert.match(PUNCH_PAD, /import \{ evaluateShiftNote \} from "@\/lib\/ai-coach\.functions"/);
    assert.match(PUNCH_PAD, /import \{ answerProceduralQuestion, type ProceduralResult \} from "@\/lib\/ai-coach\.functions"/);
  });

  it("runs the Nectar guard in every server function", () => {
    for (const name of SERVER_FNS) {
      assert.match(serverFn(name), /(requireNectarOrg|nectarCaller)\(context\)/, name);
    }
  });

  it("always sends the caller's agency to Bedrock, so the per-agency rate limit applies", () => {
    assert.match(SRC, /coachModelFor\(gatewayFetch, orgId, getRequest\(\)\?\.signal\)/);
    const direct = SRC.match(/gatewayFetch\(\{/g) ?? [];
    assert.equal(direct.length, 1, "only the reviewer calls gatewayFetch directly");
    assert.match(serverFn("reviewIncidentReport"), /orgId: caller\.orgId/);
    for (const name of SERVER_FNS.filter((n) => !["evaluateShiftNote", "reviewIncidentReport"].includes(n))) {
      assert.match(serverFn(name), /coachModel\(await requireNectarOrg\(context\)\)/, name);
    }
  });

  it("never blocks clock-out or the incident clock on Nectar being off", () => {
    const evaluate = serverFn("evaluateShiftNote");
    assert.match(evaluate, /if \(!caller\.ok && caller\.reason !== "feature_off"\) throw new Error\(caller\.message\);/);
    assert.match(evaluate, /caller\.ok \? coachModel\(caller\.orgId\) : null/);
    assert.match(serverFn("reviewIncidentReport"), /if \(!caller\.ok\) return skippedReview\(caller\.message\);/);
  });

  it("fits the lib size limit", () => {
    assert.ok(SRC.split("\n").length <= 300);
  });
});

describe("guarded coach call, end to end with fakes", () => {
  const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const deps = (memberOf: string[]): NectarCallerDeps => ({
    loadActiveOrgIds: async () => memberOf,
    loadNectarOrgIds: async (ids) => ids,
  });
  const question = validateProcedural({ question: "Can I drive to the store?" });

  it("refuses a non-member before any model call", async () => {
    const check = await checkNectarCaller("11111111-1111-4111-8111-111111111111", deps([]));
    assert.deepEqual(check, { ok: false, reason: "not_member", message: "Not a member of this organization" });
  });

  it("charges the member's agency and surfaces the rate limit", async () => {
    const check = await checkNectarCaller("11111111-1111-4111-8111-111111111111", deps([ORG]));
    assert.ok(check.ok);
    const sent: string[] = [];
    const limited: CoachGateway = async (_body, opts) => {
      sent.push(opts.orgId);
      return { ok: false, status: 429, json: async () => ({}) };
    };
    await assert.rejects(runAnswerProcedural(question, coachModelFor(limited, check.orgId)), {
      message: COACH_RATE_LIMIT_MESSAGE,
    });
    assert.deepEqual(sent, [ORG]);
  });
});
