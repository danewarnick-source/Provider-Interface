// Residents on the home page (B7, demo vPlace › Residents): each resident's
// name (opens their profile), codes this week, absence days used this plan
// year of the Worksheet number ("x of y", §21.3(3)) and away times, with
// + Add away time and Remove (Clients edit). When every resident is away,
// those hours need no staff (Decision 15).
import { Link } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { clientName, codeActiveOn } from "@/lib/scheduler/board-model";
import { absenceUse } from "@/lib/scheduler/residential-facts";
import { dayKey } from "@/lib/scheduler/time";
import { useBoard } from "@/components/scheduler/board/board-context";
import { AddAwayTime, AwayTimesList } from "@/components/clients/shared/away-times-list";
import { HomePanel } from "./home-panel";
import type { HomeResidents } from "./use-home-residents";
import { useCoverageActions } from "./use-coverage-actions";

export function ResidentsCard({
  residents,
  facts,
  days,
}: {
  residents: string[];
  facts: HomeResidents | undefined;
  days: string[];
}) {
  const b = useBoard();
  const canEdit = useAccess().canCategory("clients", "edit");
  const act = useCoverageActions(b.orgId);
  const today = dayKey(new Date());
  return (
    <HomePanel
      title="Residents"
      sub="RHS bills each resident per day. Every staff member on shift writes a section for each resident home during their shift. The one exception is a 1:1. When every resident is away, those hours need no staff."
    >
      {!residents.length ? (
        <p className="text-sm text-[var(--hive-text-muted)]">
          Nobody lives here yet. Set a client's Home on their profile to add them.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--hive-border)]">
          {residents.map((id) => {
            const codes = [
              ...new Set(
                b.data.codes
                  .filter((c) => c.client_id === id && days.some((d) => codeActiveOn(c, d)))
                  .map((c) => c.service_code.toUpperCase()),
              ),
            ];
            const abs = facts ? absenceUse(facts.absences, facts.codes, id, today) : null;
            return (
              <li key={id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    to="/dashboard/clients/$clientId"
                    params={{ clientId: id }}
                    search={{}}
                    className="text-sm font-bold hover:underline"
                  >
                    {clientName(b.clients.get(id))}
                  </Link>
                  <p className="text-xs text-[var(--hive-text-muted)]">
                    {codes.join(" · ") || "No active codes"} · absence days{" "}
                    {abs ? `${abs.used} of ${abs.allowed ?? "—"}` : "…"} used this plan year
                    {abs && abs.allowed == null
                      ? " (no Worksheet number on the RHS authorization)"
                      : ""}
                  </p>
                  <AwayTimesList
                    clientId={id}
                    away={facts?.away ?? []}
                    canEdit={canEdit}
                    act={act}
                    compact
                  />
                </div>
                {canEdit && <AddAwayTime clientId={id} act={act} />}
              </li>
            );
          })}
        </ul>
      )}
    </HomePanel>
  );
}
