import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const HELP_FNS = read("./nectar-help.functions.ts");
const HELP_PAGE = read("../routes/dashboard.help.tsx");

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
