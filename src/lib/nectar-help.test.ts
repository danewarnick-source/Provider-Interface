import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const HELP_FNS = read("./nectar-help.functions.ts");
const HELP_PAGE = read("../routes/dashboard.help.tsx");

function gatherFactsSource(): string {
  const start = HELP_FNS.indexOf("async function gatherFacts(");
  return HELP_FNS.slice(start, HELP_FNS.indexOf("\n}\n", start));
}

describe("admin help prompt (N1)", () => {
  it("drops the no-hedging rules and the retired Authoritative Sources screen", () => {
    assert.doesNotMatch(HELP_FNS, /NEVER say/);
    assert.doesNotMatch(HELP_FNS, /I'm not sure without looking/);
    assert.doesNotMatch(HELP_FNS, /Lead with the DIRECT ANSWER/);
    assert.doesNotMatch(HELP_FNS, /Authoritative Sources/);
    assert.match(HELP_FNS, /Never fabricate numbers/);
  });
});

describe("admin help facts (N1)", () => {
  it("reads agency-wide counts only for owners and agency-wide admins", () => {
    const facts = gatherFactsSource();
    const gate = facts.indexOf('if (facts.scope !== "organization") {');
    const firstRead = facts.indexOf(".from(");
    assert.ok(gate > 0 && firstRead > gate, "the scope check comes before the first read");
    assert.match(facts.slice(gate, firstRead), /return facts;/);
    assert.doesNotMatch(facts, /facts\.scope === "organization"/);
  });

  it("organization scope means owner or agency-wide admin", async () => {
    const { nectarAudienceFromMembership } = await import("./nectar-trust.ts");
    const scope = (level: string, accessScope: string) =>
      nectarAudienceFromMembership({ level, scope: accessScope }).factScope;
    assert.equal(scope("owner", "self"), "organization");
    assert.equal(scope("admin", "agency"), "organization");
    assert.equal(scope("admin", "assigned"), "self");
    assert.equal(scope("staff", "agency"), "self");
  });

  it("checks the nectar feature and the Ask setting for the agency on the server (N3)", () => {
    const ask = HELP_FNS.slice(HELP_FNS.indexOf("export const askNectarHelp"));
    const guard = ask.indexOf(
      'await requireNectarOrg(context, { orgId: data.organizationId, feature: "ask" });',
    );
    assert.ok(
      guard > 0 && guard < ask.indexOf("gatherFacts("),
      "feature check runs before any read",
    );
  });
});

describe("admin help navigation map (N2)", () => {
  it("is built from the real sidebar arrays, not written by hand", () => {
    assert.match(HELP_FNS, /import dashboardSource from "@\/routes\/dashboard\.tsx\?raw";/);
    assert.match(HELP_FNS, /\$\{navMapForPrompt\(sidebarNav\(dashboardSource\)\)\}/);
    assert.doesNotMatch(HELP_FNS, /^- \/dashboard/m);
    assert.doesNotMatch(HELP_FNS, /NAVIGATION MAP/);
    assert.match(HELP_FNS, /ROLE RULES: Staff & host-family NEVER see billing rates/);
  });
});

describe("admin help deep links (N1)", () => {
  it("are checked against real routes on the server before they are shown", () => {
    assert.match(HELP_FNS, /import \{ helpDeepLink \} from "@\/lib\/nectar\/help-links"/);
    assert.match(HELP_FNS, /const deepLink = helpDeepLink\(parsed\.deepLink\);/);
    assert.doesNotMatch(HELP_FNS, /startsWith\("\/dashboard"\)/);
  });

  it("no longer send a $clientId link to billing on the page", () => {
    assert.doesNotMatch(HELP_PAGE, /\$clientId/);
    assert.doesNotMatch(HELP_PAGE, /to: "\/dashboard\/billing" \}/);
    assert.match(HELP_PAGE, /onNavigate=\{\(path\) => window\.location\.assign\(path\)\}/);
  });
});
