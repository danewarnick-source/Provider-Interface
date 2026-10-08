// Mocked getClientOverview payload for the client profile e2e (made-up data,
// no PHI). Shape: src/lib/clients/overview.ts ClientOverview.
import type { ClientOverview } from "../../src/lib/clients/overview";
import { STAFF } from "../fixtures/tns-roster";

export function clientOverviewPayload(): ClientOverview {
  return {
    attention: [
      {
        key: "photo",
        title: "Photo is over 5 years old",
        detail: "Take a new photo",
        tone: "warn",
        section: "profile",
      },
      {
        key: "setup:Guardian not on file",
        title: "Finish setup",
        detail: "Guardian not on file",
        tone: "bad",
        section: "contacts",
      },
    ],
    strategies: { kind: "not_needed" },
    paces: [
      {
        code: "DSI",
        annual: 1000,
        used: 400,
        left: 600,
        leftPct: 60,
        elapsedPct: 50,
        usedPct: 40,
        pending: false,
        start: "2026-01-01",
        end: "2026-12-31",
      },
    ],
    mustKnows: null,
    comingUp: [
      {
        key: "plan-end",
        label: "Plan year ends",
        date: "2026-10-20",
        days: 14,
        startsAt: null,
        section: "plans",
      },
    ],
    team: [
      {
        id: STAFF.jake.id,
        name: STAFF.jake.name,
        codes: ["DSI"],
        readyAlone: true,
        readinessLabel: "Ready",
      },
    ],
    lastNotes: [
      {
        key: "daily:1",
        date: "2026-10-05",
        kind: "daily",
        code: null,
        author: null,
        text: "Made-up note: went for a walk and cooked lunch.",
      },
    ],
  };
}
