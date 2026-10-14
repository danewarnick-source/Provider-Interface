import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FakeDb } from "../engine/fake-db.ts";
import { loadShiftFacts, scheduleFact, shiftLine, shiftWindow } from "./shifts.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ME = "11111111-1111-4111-8111-111111111111";
const caller = { userId: ME, orgId: ORG, view: "staff" as const, agencyAdmin: false };
const NOW = new Date("2026-10-14T18:00:00.000Z"); // Wed Oct 14, noon in Denver

function shift(id: string, startsAt: string, endsAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    organization_id: ORG,
    staff_id: ME,
    client_id: "c-1",
    job_code: "SLN",
    service_code: null,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "scheduled",
    published: true,
    ...extra,
  };
}

describe("the caller's own published shifts (FOR THE SCHEDULER: the only Nectar reader of scheduled_shifts)", () => {
  it("covers the first of this month to 21 days ahead, in Mountain Time", () => {
    const w = shiftWindow(NOW);
    assert.equal(w.from, "2026-10-01");
    assert.equal(w.to, "2026-11-04");
    assert.equal(w.fromIso, "2026-10-01T06:00:00.000Z");
    assert.equal(w.toIso, "2026-11-05T07:00:00.000Z");
  });

  it("writes times, the client and the code; never hours", () => {
    const line = shiftLine(
      {
        id: "s",
        client_id: "c-1",
        job_code: "SLN",
        service_code: null,
        starts_at: "2026-10-15T15:00:00.000Z",
        ends_at: "2026-10-15T23:00:00.000Z",
      },
      "Client A",
    );
    assert.equal(line, "Thu, Oct 15, 9:00 AM – 5:00 PM · Client A · SLN");
    const fact = scheduleFact(caller, [], new Map(), NOW);
    assert.match(
      fact.text,
      /^Today is Wednesday, October 14, 2026 \(Mountain Time\)\.\nNo published shifts from 2026-10-01 to 2026-11-04\.$/,
    );
    assert.equal(fact.id, `schedule:${ME}`);
    assert.doesNotMatch(fact.text, /hours/i);
  });

  it("loads only for a schedule question, and only the caller's published, not cancelled shifts", async () => {
    const db = new FakeDb({
      tables: {
        scheduled_shifts: [
          shift("mine", "2026-10-15T15:00:00.000Z", "2026-10-15T23:00:00.000Z"),
          shift("someone-else", "2026-10-15T15:00:00.000Z", "2026-10-15T23:00:00.000Z", {
            staff_id: "other",
          }),
          shift("draft", "2026-10-16T15:00:00.000Z", "2026-10-16T23:00:00.000Z", {
            published: false,
          }),
          shift("cancelled", "2026-10-17T15:00:00.000Z", "2026-10-17T23:00:00.000Z", {
            status: "cancelled",
          }),
          shift("last-month", "2026-09-20T15:00:00.000Z", "2026-09-20T23:00:00.000Z"),
        ],
        clients: [{ id: "c-1", organization_id: ORG, first_name: "Client", last_name: "A" }],
      },
    });
    assert.deepEqual(
      await loadShiftFacts(db.client, caller, "What does the fire policy say?", NOW),
      [],
    );
    assert.equal(db.calls.length, 0);
    const [fact] = await loadShiftFacts(db.client, caller, "When do I work this week?", NOW);
    assert.equal(fact!.kind, "schedule");
    assert.match(fact!.text, /- Thu, Oct 15, 9:00 AM – 5:00 PM · Client A · SLN$/);
    assert.equal(fact!.text.split("\n- ").length, 2, "one shift");
    assert.deepEqual(db.callsTo("scheduled_shifts")[0]!.filters, [
      ["eq", "organization_id", ORG],
      ["eq", "staff_id", ME],
      ["eq", "published", true],
      ["neq", "status", "cancelled"],
      ["gte", "starts_at", "2026-10-01T06:00:00.000Z"],
      ["lt", "starts_at", "2026-11-05T07:00:00.000Z"],
    ]);
  });

  it("is the only Nectar file that reads scheduled_shifts", () => {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
            ? [join(dir, e.name)]
            : [],
      );
    const readers = files(root).filter((f) =>
      readFileSync(f, "utf8").includes('"scheduled_shifts"'),
    );
    assert.deepEqual(
      readers.map((f) => f.slice(root.length)),
      ["context/shifts.ts"],
    );
  });
});
