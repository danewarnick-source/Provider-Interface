// The MAR grid: one row per medication and time, one column per day. The
// first column stays put while the days scroll sideways inside the card.
// Clicking a logged cell opens that dose.

import { formatTime12, nameWithStrength } from "@/lib/medications/med-display";
import { cellCode, type CellKind, type MarCell } from "@/lib/medications/mar-cells";
import type { MarMonth } from "./use-mar";

const TONE: Record<CellKind, string> = {
  given: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  refused: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100",
  missed: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
  held: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
  away: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100",
  not_due: "bg-muted/40 text-muted-foreground",
  upcoming: "",
};

export const MAR_KEY: Array<[CellKind, string]> = [
  ["given", "Given (initials and time)"],
  ["refused", "R  Refused"],
  ["missed", "M  Missed"],
  ["held", "H  Held"],
  ["away", "NA  Not at home"],
  ["not_due", "Not due"],
];

function CellButton({ cell, onOpen }: { cell: MarCell; onOpen: (logIds: string[]) => void }) {
  const text = `${cellCode(cell)}${cell.late ? "*" : ""}${cell.error ? "!" : ""}${cell.untrained ? "#" : ""}`;
  const cls = `h-9 w-full whitespace-pre-line px-0.5 text-[10px] leading-tight ${TONE[cell.kind]}`;
  if (!cell.logId) return <div className={`${cls} flex items-center justify-center`}>{text}</div>;
  return (
    <button
      type="button"
      className={`${cls} underline-offset-2 hover:underline`}
      onClick={() => onOpen([cell.logId as string])}
      title="Open this dose"
    >
      {text.replace(" ", "\n")}
    </button>
  );
}

export function MarGridTable({
  data,
  onOpenDose,
}: {
  data: MarMonth;
  onOpenDose: (logIds: string[]) => void;
}) {
  const { days, rows } = data.grid;
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">No medications this month.</p>;
  return (
    <div className="max-w-full overflow-x-auto rounded-md border" data-testid="mar-grid">
      <table className="border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60">
            <th className="sticky left-0 z-10 min-w-44 bg-muted px-2 py-1 text-left font-medium">
              Medication and time
            </th>
            {days.map((d) => (
              <th key={d} className="min-w-11 px-0.5 py-1 text-center font-medium">
                {Number(d.slice(8))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const med = data.meds.find((m) => m.id === row.medId);
            return (
              <tr key={row.key} className="border-t">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-background px-2 py-1 text-left font-normal"
                >
                  <span className="block font-medium">{med ? nameWithStrength(med) : "—"}</span>
                  <span className="text-muted-foreground">
                    {row.time ? formatTime12(row.time) : "As needed (doses per day)"}
                    {row.oldTime ? " · earlier time" : ""}
                  </span>
                </th>
                {days.map((d, i) => (
                  <td key={d} className="border-l p-0 text-center">
                    {row.time ? (
                      <CellButton cell={row.cells[i]} onOpen={onOpenDose} />
                    ) : row.prnCounts[i] ? (
                      <button
                        type="button"
                        className="h-9 w-full bg-emerald-50 font-medium hover:underline dark:bg-emerald-950/40"
                        onClick={() => onOpenDose(row.prnLogIds[i])}
                        title="Open this day's as-needed doses"
                      >
                        {row.prnCounts[i]}
                      </button>
                    ) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
