import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./ask.functions.ts", import.meta.url), "utf8");

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("\nexport const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

function body(name: string): string {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return SRC.slice(start, SRC.indexOf("\n}\n", start));
}

describe("ask.functions.ts (N5 guards)", () => {
  it("exports askNectar, getAskStatus (N6) and feedbackNectar only", () => {
    const exported = [...SRC.matchAll(/^export const (\w+) = createServerFn/gm)].map((m) => m[1]);
    assert.deepEqual(exported, ["askNectar", "getAskStatus", "feedbackNectar"]);
  });

  it("getAskStatus: any active member, by the same check askNectar makes (N6)", () => {
    const status = serverFn("getAskStatus");
    assert.match(
      status,
      /\.middleware\(\[requireSupabaseAuth\]\)\s*\.inputValidator\(\(input: unknown\) => AskStatusInput\.parse\(input\)\)/,
    );
    assert.match(status, /const caller = await askCaller\(context, data\.organizationId\);/);
    assert.match(status, /return \{ on: caller !== null \};/);
    assert.doesNotMatch(status, /runAskNectar|gatewayFetch|nectar_questions/);
  });

  it("both run behind the auth middleware with validated input", () => {
    assert.match(
      serverFn("askNectar"),
      /\.middleware\(\[requireSupabaseAuth\]\)\s*\.inputValidator\(\(input: unknown\) => AskInput\.parse\(input\)\)/,
    );
    assert.match(
      serverFn("feedbackNectar"),
      /\.middleware\(\[requireSupabaseAuth\]\)\s*\.inputValidator\(\(input: unknown\) => FeedbackInput\.parse\(input\)\)/,
    );
  });

  it("check signed in, active member, the nectar feature and the Ask setting first; off returns the off result", () => {
    const caller = body("askCaller");
    assert.match(
      caller,
      /await nectarCaller\(context, \{ orgId: organizationId, feature: "ask" \}\)/,
    );
    assert.match(
      caller,
      /if \(isNectarOff\(check\)\) return null;\s*throw new Error\(check\.message\);/,
    );
    assert.match(caller, /await requireOrgMembership\(db, userId, check\.orgId\)/);
    assert.match(caller, /agencyAdmin: isAgencyAdmin\(access\.level, access\.scope\)/);
    const ask = serverFn("askNectar");
    assert.ok(
      ask.indexOf("await askCaller(") < ask.indexOf("runAskNectar("),
      "guard before the engine",
    );
    assert.match(ask, /if \(!caller\) return askOffResult\(\);/);
    assert.match(
      serverFn("feedbackNectar"),
      /if \(!caller\) return \{ questionId: data\.questionId, feedback: null, status: null, off: true \};/,
    );
    assert.doesNotMatch(SRC, /nectar_infusion/);
  });

  it("the admin view is for owners and agency-wide admins; scope never comes from the request", () => {
    const ask = serverFn("askNectar");
    assert.match(
      ask,
      /if \(data\.view === "admin" && !caller\.agencyAdmin\) throw new Error\(ADMIN_VIEW_ONLY\);/,
    );
    assert.match(
      ask,
      /\{\s*userId: caller\.userId,\s*orgId: caller\.orgId,\s*view: data\.view,\s*agencyAdmin: caller\.agencyAdmin,?\s*\}/,
    );
  });

  it("charges the embedding and the model call to the agency's rate limit through ai-bedrock.server", () => {
    assert.match(
      SRC,
      /import \{ gatewayEmbeddingsFetch, gatewayFetch \} from "@\/lib\/ai-bedrock\.server";/,
    );
    assert.match(
      body("questionEmbedder"),
      /gatewayEmbeddingsFetch\(\s*\{ input: text, dimensions: EMBED_DIMENSIONS \},\s*\{ orgId \},?\s*\)/,
    );
    assert.match(body("nectarModel"), /\{ orgId, signal \}/);
    assert.match(serverFn("askNectar"), /embed: questionEmbedder\(caller\.orgId\)/);
    assert.match(
      serverFn("askNectar"),
      /model: nectarModel\(caller\.orgId, getRequest\(\)\?\.signal\)/,
    );
    assert.match(body("nectarModel"), /if \(res\.status === 429\) throw new Error\(NECTAR_BUSY\);/);
  });

  it("thumbs are written server-side only after recordFeedback checks the caller asked the question", () => {
    assert.match(
      serverFn("feedbackNectar"),
      /recordFeedback\(\s*caller\.db,\s*supabaseAdmin as unknown as NectarDb,\s*caller,/,
    );
  });

  it("never logs prompts, questions or answers", () => {
    assert.doesNotMatch(SRC, /console\./);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
