import { TOMMY_GOALS } from "../fixtures";

/** Clock-out supports for the shift's code, grouped by goal (GoalView shape). */
export function useClientCareData() {
  return {
    data: {
      visibility: {
        goalsForStaff: TOMMY_GOALS.map((goal, i) => ({
          id: `goal-${i}`,
          goal,
          domain: null,
          supports: [{ id: `support-${i}`, support_text: goal, details: null, our_codes: ["SEI"] }],
        })),
      },
    },
    isLoading: false,
  };
}
