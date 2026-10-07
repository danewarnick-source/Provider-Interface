// Client list cells in words: the codes cell (active, ended, plan expired,
// never had codes), the readiness tag, the next-due line and the "+ Add …"
// shortcuts on empty cells. Pure: no React, no Supabase.

import { formatDate } from "./dates.ts";
import type { ClientListRow, DueItem } from "./list.ts";
import { DUE_SOON_DAYS, LOW_UNITS_PCT } from "./list.ts";
import { visibleClientSections, type ClientProfileSection } from "./profile-sections.ts";

const shortDate = (ymd: string) => formatDate(ymd, { month: "short", day: "numeric" });

/** The empty-cell fixes and the profile section each opens. */
export const LIST_SHORTCUTS = {
  codes: { label: "+ Add codes", section: "services" },
  home: { label: "+ Set home", section: "profile" },
  units: { label: "+ Add units", section: "services" },
  team: { label: "+ Assign team", section: "team" },
} as const satisfies Record<string, { label: string; section: ClientProfileSection }>;
export type ListShortcutKey = keyof typeof LIST_SHORTCUTS;

/** What the viewer may open and edit (from useAccess). */
export type ListViewer = {
  canMedical: boolean;
  canBilling: boolean;
  canEditClients: boolean;
  canEditBilling: boolean;
  canEditTeam: boolean;
};

/** True when the viewer can open the section and edit what it holds. */
export function canFixSection(section: ClientProfileSection, v: ListViewer): boolean {
  if (
    !visibleClientSections({ canMedical: v.canMedical, canBilling: v.canBilling }).includes(section)
  )
    return false;
  if (section === "services") return v.canEditBilling;
  if (section === "team") return v.canEditTeam;
  return v.canEditClients;
}

export type CodesCell =
  | { kind: "active"; codes: string[] }
  | {
      kind: "ended";
      codes: string[];
      /** "Ended Aug 31" or "Plan expired"; the link adds " · Renew". */
      status: string;
      section: ClientProfileSection;
    }
  | { kind: "none" };

/** Active codes; ended ones dimmed with a renew link; or none ever on file. */
export function codesCell(
  row: Pick<ClientListRow, "codes" | "endedCodes" | "planExpired">,
): CodesCell {
  if (row.codes.length) return { kind: "active", codes: row.codes };
  if (!row.endedCodes) return { kind: "none" };
  return row.planExpired
    ? { kind: "ended", codes: row.endedCodes.codes, status: "Plan expired", section: "plans" }
    : {
        kind: "ended",
        codes: row.endedCodes.codes,
        status: `Ended ${shortDate(row.endedCodes.endedOn)}`,
        section: "services",
      };
}

export type TagTone = "ok" | "danger" | "profile";

/** The readiness pill: "Ready to schedule", "<N> to fix" (reasons in the tooltip) or "Finish setup". */
export function readinessTag(row: Pick<ClientListRow, "kind" | "readiness">): {
  tone: TagTone;
  text: string;
  title?: string;
} {
  if (row.kind === "draft") return { tone: "profile", text: "Finish setup" };
  if (row.readiness.ready) return { tone: "ok", text: "Ready to schedule" };
  return {
    tone: "danger",
    text: `${row.readiness.missing.length} to fix`,
    title: row.readiness.missing.join("\n"),
  };
}

const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** Next due line; the plan year uses the Plans wording ("PCSP is N days overdue"). */
export function nextDueText(d: DueItem): string {
  if (d.kind === "plan") {
    if (d.days < 0) return `PCSP is ${plural(-d.days)} overdue`;
    return d.days === 0 ? "PCSP expires today" : `PCSP expires in ${plural(d.days)}`;
  }
  if (d.days < 0) return `${d.label} · ${plural(-d.days)} overdue`;
  return `${d.label} · ${shortDate(d.date)}`;
}

export type CellTone = "overdue" | "soon" | "normal";

export function dueTone(d: DueItem): CellTone {
  if (d.days < 0) return "overdue";
  return d.days <= DUE_SOON_DAYS ? "soon" : "normal";
}

export function unitsLow(row: Pick<ClientListRow, "unitsLeft">): boolean {
  return !!row.unitsLeft && row.unitsLeft.pct <= LOW_UNITS_PCT;
}

/** Units left with nothing to show: "+ Add units" only when an active code lacks yearly units. */
export function unitsShortcut(
  row: Pick<ClientListRow, "unitsLeft" | "codes" | "needsUnits">,
): ListShortcutKey | null {
  return !row.unitsLeft && row.codes.length > 0 && row.needsUnits ? "units" : null;
}
