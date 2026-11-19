// Needs you "Coverage gap" rows (B7): each short stretch at a staffed home
// from now to the end of next week (coverage.ts), red and first. When an
// open shift overlaps the gap the row offers Find staff / Offer on it;
// otherwise Add a shift for the gap; always No staff needed… (the gap
// dialog). Pure; buildNeeds (needs-list.ts) adds them.
import { barInstant, dayText, minuteSpan, openShiftFor, type Gap } from "./coverage.ts";
import type { BoardShift } from "./board-model.ts";
import type { NeedItem } from "./needs-items.ts";

export function gapRows(
  gaps: readonly Gap[],
  shifts: readonly BoardShift[],
  teams: ReadonlyMap<string, { name: string }>,
  offers: ReadonlyMap<string, number>,
  now: Date,
): NeedItem[] {
  return gaps
    .filter((g) => new Date(barInstant(g.day, g.to)).getTime() > now.getTime())
    .map((g) => {
      const open = openShiftFor(g, shifts);
      const offered = open ? (offers.get(open.id) ?? 0) : 0;
      return {
        key: `gap:${g.teamId}:${g.day}:${g.from}`,
        kind: "coverage_gap" as const,
        level: "crit" as const,
        tier: 0 as const,
        at: barInstant(g.day, g.from),
        title: `${teams.get(g.teamId)?.name ?? "Home"} · ${dayText(g.day)} · No one ${minuteSpan(g.from, g.to)}`,
        why: open
          ? `An open shift covers it. ${offered ? `Offered to ${offered}.` : "Not offered yet."}`
          : `Short ${g.short}. No shift covers this time.`,
        shiftId: open?.id,
        offered,
        gap: g,
      };
    });
}
