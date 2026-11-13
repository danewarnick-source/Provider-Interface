// B1 done-when: van shifts (van_route_id set). Staff under 18 are refused
// (§1.5(1)); staff with no complete driver file get a reminder (§1.30(2)).
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_KEYS, DAY, ctx, evidence, has, shift } from "./rules-fixtures.ts";
import { evaluateShift, refusalLine, verdictOf } from "./rules.ts";
import { DRIVER_FILE_KEYS, hasDriverFile } from "./rules-qualifications.ts";

const DRIVER_FILE = DRIVER_FILE_KEYS.map((k) => k.key);
const van = shift({ code: "DSG", clientId: null, vanRouteId: "route-1" });
const full = { s1: evidence([...ALL_KEYS, ...DRIVER_FILE]) };

test("assigning a 17-year-old to a van shift is refused", () => {
  const f = evaluateShift(van, ctx({ staff: { age: 17 }, evidence: full }));
  assert.ok(has(f, "under_minimum_age", "block"));
  assert.match(refusalLine(verdictOf(f)) ?? "", /17; driving clients needs 18\+ \(§1\.5\(1\)\)/);
  assert.ok(
    !has(evaluateShift(van, ctx({ staff: { age: 18 }, evidence: full })), "under_minimum_age"),
  );
  // The same 17-year-old on a shift with no van is fine.
  assert.ok(
    !has(
      evaluateShift(shift({ code: "DSG", clientId: null }), ctx({ staff: { age: 17 } })),
      "under_minimum_age",
    ),
  );
});

test("assigning someone with no driver file to a van shift saves, with a reminder", () => {
  const f = evaluateShift(
    van,
    ctx({ evidence: { s1: evidence(ALL_KEYS.filter((k) => k !== "driver_license")) } }),
  );
  assert.ok(has(f, "driver_file", "warn"));
  const v = verdictOf(f);
  assert.equal(v.blocks.length, 0);
  assert.equal(refusalLine(v), null);
  assert.ok(v.warnings.some((w) => /no driver file on record \(§1\.30\(2\)\)/.test(w.message)));
});

test("the driver file counts only when all three pieces are reviewed and current", () => {
  assert.ok(hasDriverFile(full.s1, DAY));
  assert.ok(!hasDriverFile(evidence(["driver_license", "driving_record"]), DAY));
  assert.ok(
    !hasDriverFile(evidence(DRIVER_FILE, { auto_insurance_proof: { review: "pending" } }), DAY),
  );
  assert.ok(
    !hasDriverFile(evidence(DRIVER_FILE, { driving_record: { expires: "2026-10-01" } }), DAY),
  );
  const f = evaluateShift(
    van,
    ctx({
      evidence: {
        s1: evidence([...ALL_KEYS, ...DRIVER_FILE], {
          auto_insurance_proof: { review: "pending" },
        }),
      },
    }),
  );
  assert.ok(
    f.some((x) => x.rule === "driver_file" && /insurance waiting for review/.test(x.message)),
  );
  assert.ok(!has(evaluateShift(van, ctx({ evidence: full })), "driver_file"));
});
