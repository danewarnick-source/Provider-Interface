// Training server functions act in the agency the request names, not
// whichever of the person's agencies comes back first.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// The training server functions and their shared checks, read as one.
const src = ["training.functions.ts", "training-guards.server.ts", "training-strategies.functions.ts", "training-staff.functions.ts"]
  .map((f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8"))
  .join("\n");
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Each exported server function's source. */
function serverFns(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /export const (\w+) = createServerFn/g;
  const starts = [...src.matchAll(re)].map((m) => ({ name: m[1], at: m.index ?? 0 }));
  starts.forEach((s, i) => out.set(s.name, src.slice(s.at, starts[i + 1]?.at ?? src.length)));
  return out;
}

describe("training functions pick the right agency", () => {
  const fns = serverFns();

  it("never picks a membership with .limit(1) across agencies", () => {
    const mem = src.slice(
      src.indexOf("async function getMembership"),
      src.indexOf("async function guardClient"),
    );
    assert.doesNotMatch(mem, /\.limit\(1\)/);
    assert.match(mem, /requireOrgMembership\(supabase, userId, organizationId\)/);
    assert.doesNotMatch(src, /getMembership\(supabase, userId\)/);
  });

  it("every function that reads agency data takes organizationId from the request", () => {
    for (const [name, body] of fns) {
      if (name === "checkAnswerRelevance") continue; // no agency data
      assert.match(body, /organizationId: z\.string\(\)\.uuid\(\)/, name);
      assert.match(body, /getMembership\(supabase, userId, data\.organizationId\)/, name);
    }
  });

  it("admin writes go through assertCanManageClient (scope, discharged)", () => {
    const writes = [
      "draftClientSpecificTrainingWithNectar",
      "draftClientSpecificTrainingBlank",
      "attachClientSpecificTrainingDocument",
      "updateClientSpecificTraining",
      "publishClientSpecificTraining",
      "saveReviewQuestions",
      "draftSupportStrategies",
      "attachSupportStrategyDocument",
    ];
    for (const name of writes) {
      assert.match(
        fns.get(name) ?? "",
        /guardClient\(supabase, userId, m\.organization_id, [\w.]+, "edit"\)/,
        name,
      );
    }
    assert.match(
      src,
      /assertCanManageClient\(\{ supabase, actorId: userId, organizationId, clientId, action \}\)/,
    );
  });

  it("staff reads check the client is in the agency and in a scoped admin's scope", () => {
    const check = src.slice(
      src.indexOf("async function assertStaffMayViewClient"),
      src.indexOf("async function sha256Hex"),
    );
    assert.match(check, /assertClientInOrg\(supabase, clientId, orgId\)/);
    assert.match(check, /access\.scope === "agency"/);
    assert.match(check, /access_can_see_client/);
  });

  it("dates use the Denver day", () => {
    assert.doesNotMatch(src, /toISOString\(\)\.slice\(0, 10\)/);
  });

  it("callers send the agency", () => {
    for (const p of [
      "../../../components/staff-client-grid.tsx",
      "../../../routes/dashboard.my-obligations.tsx",
      "../../../routes/dashboard.client-training.$clientId.tsx",
      "../../../components/clients/profile/client-specific-training-card.tsx",
      "../../../components/clients/profile/plans/support-strategies-panel.tsx",
    ]) {
      assert.match(read(p), /organizationId/, p);
    }
  });
});
