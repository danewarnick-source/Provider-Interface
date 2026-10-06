// Wiring checks for the Overview loaders (they need a live Supabase client,
// so the pure parts are tested in readiness/overview tests).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const load = readFileSync(new URL("./overview-load.ts", import.meta.url), "utf8");
const team = readFileSync(new URL("./overview-team.ts", import.meta.url), "utf8");
const fn = readFileSync(new URL("./overview.functions.ts", import.meta.url), "utf8");

describe("client overview loaders", () => {
  it("use the one needs-attention calculation and the one units path", () => {
    assert.match(load, /clientAttention\(/);
    assert.match(load, /usedUnitsForCode\(/);
    assert.match(load, /codePace\(/);
    assert.match(load, /hhs_daily_records_v|loadUsage\(/);
  });

  it("share Team Members readiness for ready-alone and never embed profiles", () => {
    assert.match(team, /staffClientReadiness\(/);
    assert.doesNotMatch(team, /organization_members\s*\(/);
    assert.doesNotMatch(team + load, /profiles\s*\(/);
    assert.doesNotMatch(team + load, /\brole\b/);
  });

  it("check the caller can see the client first", () => {
    assert.match(fn, /assertCanManageClient\(/);
    assert.match(fn, /action: "view"/);
  });
});
