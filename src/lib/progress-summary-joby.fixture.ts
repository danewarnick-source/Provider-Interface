// Fixed test data: a fictional person, "Joby Austin", SLN, quarterly summary
// 2026-10-01 to 2026-12-31. The progress text mentions painting, ukulele,
// laundry, meals, a budget and dates before the quarter (8/5, 9/16,
// September) on purpose: none of that is a problem. Used by the tests only.

import { emptyEditorState, type SummaryEditorState } from "./progress-summary-doc.ts";
import type { ReviewContext } from "./progress-summary-review.ts";

export const JOBY_PERIOD = { start: "2026-10-01", end: "2026-12-31", due: "2027-01-15" } as const;

export const JOBY_ILS_GOAL = "Joby would like to work on Independent Living Skills";
export const JOBY_TALENT_GOAL = "Joby would like to work on her talents";

export const JOBY: ReviewContext = {
  serviceCodes: ["SLN"],
  summaryKind: "narrative",
  includeGoalProgress: true,
  firstName: "Joby",
  goals: [
    { id: "ils", goal: JOBY_ILS_GOAL, supports: [] },
    {
      id: "talent",
      goal: JOBY_TALENT_GOAL,
      supports: [{ support: "Joby will practice piano with staff support", details: "" }],
    },
  ],
};

export const JOBY_EDITOR: SummaryEditorState = {
  ...emptyEditorState(),
  general:
    "Joby is happy in her apartment and enjoys her services. In September she moved into a new place and went to an art show with her housemate.",
  goals: {
    ils: "Joby did her own laundry every week and planned and cooked meals with staff. On 8/5 she made her first budget and in September she began tracking her spending.",
    talent:
      "Joby painted at the art center on 9/16 and sold a painting. She is learning ukulele and plays for her housemates.",
  },
};

export const JOBY_ROW = {
  summary_kind: "narrative",
  service_codes: ["SLN"],
  period_end: JOBY_PERIOD.end,
  due_date: JOBY_PERIOD.due,
  sc_sent_at: null as string | null,
  completed_at: null as string | null,
};
