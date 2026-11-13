// The Authorizations (1056) panel above the Clients view: authorized, used +
// scheduled, left, the standard week and the outlook for each client's codes
// over the plan year. Read-only. Rows come from loadAuthOutlook (lib/scheduler/board-data.ts).
import {
  fmtDay,
  OUTLOOK_LABEL,
  outlookMessage,
  type OutlookStatus,
} from "@/lib/scheduler/auth-outlook";
import { clientName } from "@/lib/scheduler/board-model";
import { useBoard } from "./board-context";
import { CodeTag, Pill, type Tone } from "./board-ui";
import type { OutlookRow } from "@/lib/scheduler/board-data";

const TONE: Record<OutlookStatus, Tone> = { ok: "ok", watch: "warn", act: "crit", under: "info" };

export function AuthPanel({ rows, loading }: { rows: OutlookRow[] | undefined; loading: boolean }) {
  const b = useBoard();
  const list = (rows ?? [])
    .filter((r) => b.clients.has(r.clientId))
    .sort((x, y) =>
      clientName(b.clients.get(x.clientId)).localeCompare(clientName(b.clients.get(y.clientId))),
    );
  const ends = [...new Set(list.map((r) => r.planEnd))];
  return (
    <section className="border-b border-[var(--hive-border)] px-4 py-4">
      <h2 className="text-sm font-bold">
        Authorizations (the 1056)
        {ends.length === 1 ? ` · plan year to ${fmtDay(ends[0]!)}` : " · each client's plan year"}
      </h2>
      <p className="mb-3 mt-0.5 text-xs text-[var(--hive-text-muted)]">
        Used plus this week's schedule, against what's authorized. The outlook uses each client's
        standard week (the next 4 weeks' schedule, averaged), so a shortfall shows up months ahead.
      </p>
      {loading && <p className="text-sm text-[var(--hive-text-muted)]">Loading authorizations…</p>}
      {!loading && !list.length && (
        <p className="text-sm text-[var(--hive-text-muted)]">
          No client has an active authorization with units and plan dates.
        </p>
      )}
      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-[var(--hive-text-muted)]">
              <tr>
                {[
                  "Client",
                  "Code",
                  "Authorized",
                  "Used + scheduled",
                  "Left",
                  "Standard week",
                  "Outlook",
                ].map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={`${r.clientId}:${r.code}`}
                  className="border-t border-[var(--hive-border)] align-top"
                >
                  <td className="py-1.5 pr-3 font-semibold">
                    {clientName(b.clients.get(r.clientId))}
                  </td>
                  <td className="py-1.5 pr-3">
                    <CodeTag code={r.code} />
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {r.authorized} {r.unit}
                    {r.unit === "h" && (
                      <span className="text-[var(--hive-text-muted)]">
                        {" "}
                        ({r.authorizedUnits} units)
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {r.outlook.used} {r.unit}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {r.outlook.left} {r.unit}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {Math.round(r.standardWeek * 100) / 100} {r.unit}
                  </td>
                  <td className="py-1.5">
                    <Pill tone={TONE[r.outlook.status]}>{OUTLOOK_LABEL[r.outlook.status]}</Pill>{" "}
                    <span>{outlookMessage(r.outlook, r.unit)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
