// What a board cell shows besides shift chips: grey "off" chips (time off,
// "With host", "no staff needed") and, at a staffed home, the day's red
// "No one 3p–7p ›" gap bars (coverage.ts) that open the gap dialog (B7).
import { minuteSpan } from "@/lib/scheduler/coverage";
import type { Board } from "./board-context";

export function OffChip({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-1 rounded-md bg-[var(--hive-muted-surface)] px-1.5 py-1 text-[11px] leading-tight text-[var(--hive-text-muted)]">
      <b className="block text-[var(--hive-text)]">{title}</b>
      {sub}
    </div>
  );
}

/** A day's "no staff needed" blocks and gap bars at a home. */
export function DayCoverage({ b, teamId, day }: { b: Board; teamId: string; day: string }) {
  const c = b.coverage.get(teamId)?.find((x) => x.day === day);
  if (!c) return null;
  return (
    <>
      {c.noStaff.map((x) => (
        <OffChip
          key={x.id}
          title={`${minuteSpan(x.from, x.to)} · no staff needed`}
          sub={x.reason}
        />
      ))}
      {c.gaps.map((g) => (
        <button
          key={g.from}
          type="button"
          onClick={() => b.open({ kind: "gap", gap: g })}
          className="mb-1 block min-h-8 w-full rounded-md bg-[var(--hive-danger-soft)] px-1.5 py-1 text-left text-[11.5px] font-bold text-[var(--hive-danger)]"
        >
          No one {minuteSpan(g.from, g.to)}
          {g.short > 1 ? ` · short ${g.short}` : ""} ›
        </button>
      ))}
    </>
  );
}
