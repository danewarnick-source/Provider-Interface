// Two home page panels (B7): Worksheet staffing hours (the residents' RHS
// Worksheet weekly hours vs hours scheduled with staff vs still open, §1.33;
// "Short N h" until open shifts fill) and 1:1 enhanced staffing (chips for
// RHS shifts naming a resident; each says whether a Form 930 covers that day,
// §21.3(4); a chip opens the shift). The math is lib/scheduler/home-week.ts.
import { oneToOneChips, worksheetHours } from "@/lib/scheduler/home-week";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { clientName, fmtSpan } from "@/lib/scheduler/board-model";
import { dayText } from "@/lib/scheduler/coverage";
import { firstName, staffName, useBoard } from "@/components/scheduler/board/board-context";
import { Pill } from "@/components/scheduler/board/board-ui";
import { HomePanel } from "./home-panel";
import type { HomeResidents } from "./use-home-residents";

type Props = {
  teamId: string;
  residents: string[];
  facts: HomeResidents | undefined;
  days: string[];
};

export function WorksheetCard({ teamId, residents, facts, days }: Props) {
  const b = useBoard();
  const w = worksheetHours(teamId, residents, facts?.codes ?? [], b.shifts, days);
  return (
    <HomePanel
      title="Worksheet staffing hours"
      sub="The contract requires delivering the staffing hours on each resident's DSPD Worksheet (§1.33). Staff punches are the proof."
    >
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--hive-text-muted)]">Worksheet, per week</dt>
          <dd className="font-bold">{w.worksheet == null ? "Not set" : `${w.worksheet} h`}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--hive-text-muted)]">Scheduled with staff</dt>
          <dd className="font-bold">{w.staffed} h</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--hive-text-muted)]">Still open</dt>
          <dd className="font-bold">{w.open} h</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--hive-text-muted)]">Status</dt>
          <dd>
            {w.worksheet == null ? (
              <span className="text-xs text-[var(--hive-text-muted)]">
                Add Worksheet weekly hours on each resident's RHS authorization.
              </span>
            ) : w.short > 0 ? (
              <Pill tone="crit">Short {w.short} h until open shifts fill</Pill>
            ) : (
              <Pill tone="ok">Meets the Worksheet</Pill>
            )}
          </dd>
        </div>
      </dl>
    </HomePanel>
  );
}

export function OneToOneCard({ teamId, residents, facts, days }: Props) {
  const b = useBoard();
  const chips = oneToOneChips(teamId, residents, facts?.form930 ?? [], b.shifts, days);
  if (!chips.length) return null;
  return (
    <HomePanel
      title="1:1 enhanced staffing"
      sub="4+ hours a day of 1:1 needs a Form 930 before it starts (§21.3(4)). These shifts name the resident, don't count toward house coverage, and the 1:1 staff writes that resident's note."
    >
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.shift.id}
            type="button"
            onClick={() => b.open({ kind: "shift", id: c.shift.id })}
            className={`min-h-11 rounded-lg px-2.5 py-1 text-left text-xs ${
              c.shift.staff_id
                ? "bg-[var(--hive-muted-surface)]"
                : "bg-[var(--hive-danger-soft)] text-[var(--hive-danger)]"
            }`}
          >
            <b className="block">
              {dayText(c.day)} · {firstName(clientName(b.clients.get(c.clientId)))} ·{" "}
              {c.shift.staff_id ? firstName(staffName(b, c.shift.staff_id)) : "Open"}{" "}
              {fmtSpan(c.shift)}
            </b>
            {c.form930 ? (
              <span className="text-[var(--hive-ok)]">
                Form 930 on file
                {c.form930.effective_to ? ` until ${fmtDay(c.form930.effective_to)}` : ""}
              </span>
            ) : (
              <span className="font-bold text-[var(--hive-danger)]">No Form 930</span>
            )}
          </button>
        ))}
      </div>
    </HomePanel>
  );
}
