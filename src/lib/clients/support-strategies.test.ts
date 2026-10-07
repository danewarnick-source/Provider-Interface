import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GoalView } from "./plans.ts";
import {
  agencySupports,
  buildStrategySections,
  groupByGoal,
  isUploadDoc,
  strategyCoverage,
  strategyStatus,
  strategyStatusText,
  strategyView,
  supportsToDraft,
  withStrategy,
  type StrategySupport,
} from "./support-strategies.ts";

const goals: GoalView[] = [
  {
    id: "g1",
    kind: "goal",
    goal: "Pat will cook a simple meal each week.",
    domain: "Healthy Living",
    supports: [
      {
        id: "s1",
        support_text: "Staff coach Pat through each recipe step.",
        details: "Use the picture binder.",
        our_codes: ["DSI"],
      },
      {
        id: "s2",
        support_text: "Behavior consultant reviews the kitchen plan.",
        details: null,
        our_codes: [],
      },
      {
        id: "s3",
        support_text: "Staff help Pat clean up.",
        details: "",
        our_codes: ["DSI", "HHS"],
      },
    ],
  },
  {
    id: "g9",
    kind: "other_need",
    goal: "Other needs in the PCSP",
    domain: null,
    supports: [
      {
        id: "s9",
        support_text: "Host home helps with daily living.",
        details: null,
        our_codes: ["HHS"],
      },
    ],
  },
  {
    id: "g2",
    kind: "goal",
    goal: "Pat will work at a job.",
    domain: null,
    supports: [
      {
        id: "s4",
        support_text: "Job coach supports Pat at work.",
        details: null,
        our_codes: ["SEI"],
      },
    ],
  },
];

describe("agencySupports", () => {
  it("lists one entry per support paid to the agency; other providers' supports are skipped", () => {
    const list = agencySupports(goals);
    assert.deepEqual(
      list.map((s) => s.supportId),
      ["s1", "s3", "s4", "s9"],
    );
    assert.deepEqual(list[1].codes, ["DSI", "HHS"]);
    assert.equal(list[3].goal, "Other need in the PCSP");
    assert.equal(list[0].details, "Use the picture binder.");
  });
});

describe("buildStrategySections", () => {
  const supports = agencySupports(goals);

  it("builds one section per agency support with goal, support, codes, details and the draft", () => {
    const secs = buildStrategySections(supports, [], new Map([["s1", "Show each step."]]));
    assert.equal(secs.length, 4);
    const v = strategyView(secs[0]);
    assert.deepEqual(
      { ...v },
      {
        id: "ss_s1",
        supportId: "s1",
        goal: "Pat will cook a simple meal each week.",
        support: "Staff coach Pat through each recipe step.",
        details: "Use the picture binder.",
        codes: ["DSI"],
        strategy: "Show each step.",
        edited: false,
      },
    );
    assert.equal(strategyView(secs[1]).strategy, "");
  });

  it("keeps sections a person edited and only drafts the rest", () => {
    const first = buildStrategySections(supports, [], new Map());
    const edited = withStrategy({ sections: first }, "ss_s3", "Hand Pat the towel first.").sections;
    assert.deepEqual(
      supportsToDraft(supports, edited).map((s) => s.supportId),
      ["s1", "s4", "s9"],
    );
    const rebuilt = buildStrategySections(
      supports,
      edited.filter((x) => x.edited),
      new Map([
        ["s3", "Nectar text"],
        ["s1", "New draft"],
      ]),
    );
    assert.equal(strategyView(rebuilt[1]).strategy, "Hand Pat the towel first.");
    assert.equal(rebuilt[1].edited, true);
    assert.equal(strategyView(rebuilt[0]).strategy, "New draft");
  });

  it("matches an edited section to the new PCSP's support by its wording, and keeps orphans", () => {
    const old = withStrategy(
      { sections: buildStrategySections(supports, [], new Map()) },
      "ss_s4",
      "Ride along the first week.",
    ).sections;
    const gone = withStrategy({ sections: old }, "ss_s9", "Kept text.").sections;
    const newPlan: StrategySupport[] = [
      {
        supportId: "n4",
        goal: "Pat will work at a job.",
        support: "Job coach supports Pat at work.",
        details: "",
        codes: ["SEI"],
      },
    ];
    const rebuilt = buildStrategySections(
      newPlan,
      gone.filter((x) => x.edited),
      new Map(),
    );
    assert.equal(rebuilt.length, 2);
    assert.deepEqual(
      [rebuilt[0].support_id, strategyView(rebuilt[0]).strategy],
      ["n4", "Ride along the first week."],
    );
    assert.equal(strategyView(rebuilt[1]).strategy, "Kept text.");
  });
});

describe("coverage, status and grouping", () => {
  const supports = agencySupports(goals);
  const secs = buildStrategySections(
    supports,
    [],
    new Map([
      ["s1", "A"],
      ["s3", "B"],
    ]),
  );

  it("counts supports with a written strategy", () => {
    const c = strategyCoverage(supports, secs);
    assert.deepEqual([c.covered, c.total], [2, 4]);
    assert.deepEqual(
      c.missing.map((s) => s.supportId),
      ["s4", "s9"],
    );
  });

  it("says draft, approved by whom, or out of date", () => {
    const draft = strategyStatus(
      { status: "draft", approved_at: null },
      null,
      null,
      supports,
      secs,
    );
    assert.equal(strategyStatusText(draft), "Draft: review and approve");
    const ok = strategyStatus(
      { status: "published", approved_at: "2026-09-25T15:00:00Z" },
      "Robin Example",
      { created_at: "2026-09-01T00:00:00Z" },
      supports,
      secs,
    );
    assert.equal(strategyStatusText(ok), "Approved Sep 25, 2026 by Robin Example");
    const newer = strategyStatus(
      { status: "published", approved_at: "2026-09-25T15:00:00Z" },
      "Robin Example",
      { created_at: "2026-10-01T00:00:00Z" },
      supports,
      secs,
    );
    assert.equal(
      strategyStatusText(newer),
      "Out of date: the PCSP changed since these were approved",
    );
    const added = strategyStatus(
      { status: "published", approved_at: "2026-09-25T15:00:00Z" },
      "R",
      null,
      supports,
      secs.slice(1),
    );
    assert.equal(added.kind, "outdated");
  });

  it("groups strategies under their goal", () => {
    const groups = groupByGoal(secs.map(strategyView));
    assert.deepEqual(
      groups.map((g) => [g.goal, g.items.length]),
      [
        ["Pat will cook a simple meal each week.", 2],
        ["Pat will work at a job.", 1],
        ["Other need in the PCSP", 1],
      ],
    );
  });

  it("reads older per-goal sections", () => {
    const legacy = strategyView({
      id: "x",
      title: "Support strategy",
      items: [
        { kind: "text", label: "Goal this supports", value: "Old goal" },
        { kind: "text", label: "Instructions to staff", value: "Old text" },
      ],
    });
    assert.deepEqual(
      [legacy.goal, legacy.strategy, legacy.supportId],
      ["Old goal", "Old text", null],
    );
  });
});

describe("isUploadDoc", () => {
  it("is one section holding one file link", () => {
    const link = {
      kind: "link" as const,
      label: "Provider document",
      links: [{ label: "plan.pdf", href: null }],
    };
    assert.equal(isUploadDoc({ sections: [{ id: "a", title: "Uploaded", items: [link] }] }), true);
    assert.equal(isUploadDoc({ sections: [] }), false);
    assert.equal(isUploadDoc(null), false);
  });
});
