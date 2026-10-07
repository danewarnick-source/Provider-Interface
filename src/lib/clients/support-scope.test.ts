import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allHiddenCards,
  cardShows,
  cleanAnswers,
  hiddenCards,
  setupPending,
  showAgainAnswers,
  type ScopeCard,
  type SupportScope,
} from "./support-scope.ts";

const VALUES = [true, false, null] as const;
const scope = (patch: Partial<SupportScope> = {}): SupportScope => ({
  helps_with_medications: null,
  helps_with_appointments: null,
  has_advance_directive: null,
  has_bsp: null,
  no_photo: null,
  setup_started_at: null,
  setup_finished_at: null,
  ...patch,
});

describe("cardShows: every answer combination", () => {
  it("medications, health events and the photo follow their one answer", () => {
    for (const meds of VALUES)
      for (const appts of VALUES)
        for (const noPhoto of VALUES) {
          const s = scope({
            helps_with_medications: meds,
            helps_with_appointments: appts,
            no_photo: noPhoto,
          });
          assert.equal(cardShows("medications", s), meds !== false, `meds=${meds}`);
          assert.equal(cardShows("health_events", s), appts !== false, `appts=${appts}`);
          assert.equal(cardShows("photo", s), noPhoto !== true, `noPhoto=${noPhoto}`);
        }
  });

  it("advance directive hides on No unless a DNR/POLST is recorded", () => {
    for (const answer of VALUES)
      for (const directiveOnFile of [true, false]) {
        const shows = cardShows("advance_directive", scope({ has_advance_directive: answer }), {
          needsBsp: false,
          directiveOnFile,
        });
        assert.equal(shows, answer !== false || directiveOnFile, `${answer}/${directiveOnFile}`);
      }
  });

  it("BSP shows on Yes, or when BC codes need it and nobody said No", () => {
    const expect: Record<string, boolean> = {
      "true/true": true,
      "true/false": true,
      "false/true": false,
      "false/false": false,
      "null/true": true,
      "null/false": false,
    };
    for (const answer of VALUES)
      for (const needsBsp of [true, false]) {
        const shows = cardShows("bsp", scope({ has_bsp: answer }), {
          needsBsp,
          directiveOnFile: false,
        });
        assert.equal(shows, expect[`${answer}/${needsBsp}`], `${answer}/${needsBsp}`);
      }
  });

  it("no answers (or no row) shows everything that applies", () => {
    assert.deepEqual(allHiddenCards(null), []);
    assert.deepEqual(allHiddenCards(scope()), []);
  });
});

describe("hiddenCards per section", () => {
  const allNo = scope({
    helps_with_medications: false,
    helps_with_appointments: false,
    has_advance_directive: false,
    has_bsp: false,
    no_photo: true,
  });
  it("lists Health's hidden cards in order", () => {
    assert.deepEqual(hiddenCards("health", allNo), [
      "medications",
      "health_events",
      "advance_directive",
    ]);
    assert.deepEqual(hiddenCards("profile", allNo), ["photo"]);
  });
  it("counts the BSP only when the codes would show it", () => {
    assert.deepEqual(hiddenCards("plans", allNo), []);
    assert.deepEqual(hiddenCards("plans", allNo, { needsBsp: true, directiveOnFile: false }), [
      "bsp",
    ]);
  });
  it("Show again flips the answer back", () => {
    for (const card of ["photo", "medications", "health_events", "advance_directive", "bsp"] as ScopeCard[]) {
      const back = scope({ ...allNo, ...showAgainAnswers(card) });
      assert.equal(cardShows(card, back, { needsBsp: true, directiveOnFile: false }), true, card);
    }
  });
});

describe("setupPending", () => {
  it("shows the banner from Add client until finished; old clients have none", () => {
    assert.equal(setupPending(null), false);
    assert.equal(setupPending(scope({ setup_started_at: "2026-10-01T00:00:00Z" })), true);
    assert.equal(
      setupPending(
        scope({ setup_started_at: "2026-10-01T00:00:00Z", setup_finished_at: "2026-10-02T00:00:00Z" }),
      ),
      false,
    );
  });
});

describe("cleanAnswers", () => {
  it("keeps only known boolean/null answers", () => {
    assert.deepEqual(
      cleanAnswers({ has_bsp: true, no_photo: null, setup_finished_at: "x", other: true, has_advance_directive: "yes" }),
      { has_bsp: true, no_photo: null },
    );
  });
});
