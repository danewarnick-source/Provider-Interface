// Source checks: "today" on client screens and server functions is the Denver
// date (denverYmd / todayYmd), never the UTC date from toISOString(), and an
// authorization still counts on its last day (authorizationCovers, >=).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const UTC_TODAY = /toISOString\(\)\.(slice\(0, ?10\)|split\("T"\)\[0\]|substring\(0, ?10\))/;

describe("Denver today", () => {
  const files: [string, RegExp][] = [
    ["./create/import-schema.ts", /const today = denverYmd\(\);/],
    ["./file/file-index.ts", /const today = denverYmd\(\);/],
    ["./file/file.ts", /liveDocs\(facts\.docs, denverYmd\(now\)\)/],
    ["../../components/clients/shared/hooks/use-client-billing-codes.tsx", /const today = denverYmd\(\);/],
    ["./care-data.functions.ts", /const today = todayYmd\(\);/],
    ["./team/training.functions.ts", /const today = denverYmd\(\);/],
  ];
  for (const [file, uses] of files) {
    it(`${file} has no UTC "today"`, () => {
      const src = read(file);
      assert.doesNotMatch(src, UTC_TODAY);
      assert.match(src, uses);
    });
  }

  it("todayYmd is the Denver date", () => {
    assert.match(read("./dates.ts"), /return denverYmd\(now\);/);
  });
});

describe("authorization end dates are inclusive", () => {
  it("the client's codes and the shift care data keep a code on its last day", () => {
    assert.match(
      read("../../components/clients/shared/hooks/use-client-billing-codes.tsx"),
      /rows\.filter\(\(r\) => authorizationCovers\(r\.service_end_date, today\)\)/,
    );
    assert.match(
      read("./care-data.functions.ts"),
      /\.filter\(\(c\) => authorizationCovers\(c\.service_end_date, today\)\)/,
    );
    assert.match(read("./team/training.functions.ts"), /c\.service_end_date >= today/);
  });
});
