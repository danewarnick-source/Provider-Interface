import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COACH_RATE_LIMIT_MESSAGE,
  coachModelFor,
  parseModelJson,
  type CoachGateway,
} from "./coach-model.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fakeGateway(reply: { status?: number; content?: string }) {
  const calls: Array<{ body: Parameters<CoachGateway>[0]; opts: Parameters<CoachGateway>[1] }> = [];
  const gateway: CoachGateway = async (body, opts) => {
    calls.push({ body, opts });
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ choices: [{ message: { content: reply.content } }] }),
    };
  };
  return { gateway, calls };
}

describe("coachModelFor", () => {
  it("sends the agency id with every call, so the per-agency rate limit applies", async () => {
    const { gateway, calls } = fakeGateway({ content: "{\"ok\":true}" });
    const signal = new AbortController().signal;
    const model = coachModelFor(gateway, ORG, signal);
    assert.equal(await model("SYSTEM", "USER"), "{\"ok\":true}");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].opts, { signal, orgId: ORG });
    assert.deepEqual(calls[0].body.messages, [
      { role: "system", content: "SYSTEM" },
      { role: "user", content: "USER" },
    ]);
    assert.deepEqual(calls[0].body.response_format, { type: "json_object" });
  });

  it("turns the limiter's 429 into the rate-limit message", async () => {
    const { gateway } = fakeGateway({ status: 429 });
    await assert.rejects(coachModelFor(gateway, ORG)("s", "u"), { message: COACH_RATE_LIMIT_MESSAGE });
  });

  it("reports other gateway failures by status only", async () => {
    const { gateway } = fakeGateway({ status: 500 });
    await assert.rejects(coachModelFor(gateway, ORG)("s", "u"), { message: "AI error (500)." });
  });

  it("returns an empty string when the model sent no text", async () => {
    const { gateway } = fakeGateway({});
    assert.equal(await coachModelFor(gateway, ORG)("s", "u"), "");
  });
});

describe("parseModelJson", () => {
  it("reads strict JSON, or the first {...} block inside prose", () => {
    assert.deepEqual(parseModelJson("{\"draft\":\"x\"}"), { draft: "x" });
    assert.deepEqual(parseModelJson("Sure! {\"draft\":\"x\"} done"), { draft: "x" });
  });

  it("returns {} for anything it can't read as an object", () => {
    assert.deepEqual(parseModelJson("not json"), {});
    assert.deepEqual(parseModelJson("{broken"), {});
    assert.deepEqual(parseModelJson("null"), {});
    assert.deepEqual(parseModelJson("42"), {});
    assert.deepEqual(parseModelJson(""), {});
  });
});
