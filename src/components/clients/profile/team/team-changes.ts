// What the Team section refreshes after a change to who works with a client.

import type { QueryClient } from "@tanstack/react-query";

export function invalidateTeam(qc: QueryClient): void {
  for (const key of ["client-team", "client-overview", "caseload", "my-assignments", "scheduler-data"]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}
