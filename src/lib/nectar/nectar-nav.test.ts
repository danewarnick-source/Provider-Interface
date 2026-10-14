import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAdminNectarSearch,
  parseStaffNectarSearch,
  SEARCH_QUESTION_MAX,
  staffNectarHref,
  staffNectarView,
} from "./nectar-nav.ts";

const DOC = "11111111-1111-4111-8111-111111111111";
const SECTION = "22222222-2222-4222-8222-222222222222";

describe("admin Nectar search params (N6)", () => {
  it("keeps the Questions and AI settings tabs and drops anything else", () => {
    assert.deepEqual(parseAdminNectarSearch({ tab: "questions" }), { tab: "questions" });
    assert.deepEqual(parseAdminNectarSearch({ tab: "settings" }), { tab: "settings" });
    assert.deepEqual(parseAdminNectarSearch({ tab: "ask" }), {});
    assert.deepEqual(parseAdminNectarSearch({ tab: "sources", clientId: DOC }), {});
  });

  it("keeps a header-search question, trimmed and capped", () => {
    assert.deepEqual(parseAdminNectarSearch({ q: "  What is due?  " }), { q: "What is due?" });
    assert.deepEqual(parseAdminNectarSearch({ q: "   " }), {});
    const long = parseAdminNectarSearch({ q: "x".repeat(SEARCH_QUESTION_MAX + 50) });
    assert.equal(long.q?.length, SEARCH_QUESTION_MAX);
    assert.deepEqual(parseAdminNectarSearch({ q: 42 }), {}, "only text is a question");
  });
});

describe("team member Nectar search params (N6)", () => {
  it("opens the Policies tab, a policy or a state rule section", () => {
    assert.deepEqual(parseStaffNectarSearch({ tab: "policies" }), { tab: "policies" });
    assert.deepEqual(parseStaffNectarSearch({ tab: "policies", doc: DOC }), {
      tab: "policies",
      doc: DOC,
    });
    assert.deepEqual(parseStaffNectarSearch({ section: SECTION }), { section: SECTION });
  });

  it("drops ids that aren't uuids, old params and unknown tabs; a policy wins over a section", () => {
    assert.deepEqual(parseStaffNectarSearch({ doc: "1; drop", clientId: DOC, tab: "x" }), {});
    assert.deepEqual(parseStaffNectarSearch({ doc: DOC, section: SECTION }), { doc: DOC });
  });

  it("links to a policy from the tab it was opened on", () => {
    assert.equal(staffNectarHref(), "/dashboard/ask-nectar");
    assert.equal(staffNectarHref({ tab: "policies" }), "/dashboard/ask-nectar?tab=policies");
    assert.equal(staffNectarHref({ tab: "ask", doc: DOC }), `/dashboard/ask-nectar?doc=${DOC}`);
    assert.equal(
      staffNectarHref({ tab: "policies", doc: DOC }),
      `/dashboard/ask-nectar?tab=policies&doc=${DOC}`,
    );
    assert.equal(staffNectarHref({ section: SECTION }), `/dashboard/ask-nectar?section=${SECTION}`);
  });

  it("says what the screen shows", () => {
    assert.deepEqual(staffNectarView({}), { kind: "tab", tab: "ask" });
    assert.deepEqual(staffNectarView({ tab: "policies" }), { kind: "tab", tab: "policies" });
    assert.deepEqual(staffNectarView({ tab: "policies", doc: DOC }), {
      kind: "policy",
      documentId: DOC,
      tab: "policies",
    });
    assert.deepEqual(staffNectarView({ section: SECTION }), {
      kind: "section",
      sectionId: SECTION,
      tab: "ask",
    });
  });

  it("round-trips: a link parses back to the same view", () => {
    for (const search of [{ tab: "policies" as const, doc: DOC }, { section: SECTION }, {}]) {
      const href = staffNectarHref(search);
      const params = Object.fromEntries(new URL(href, "https://example.test").searchParams);
      assert.deepEqual(parseStaffNectarSearch(params), search);
    }
  });
});
