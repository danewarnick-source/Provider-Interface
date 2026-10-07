// The client profile Overview: data shape plus the pure pieces (needs
// attention summary, coming up, last notes). Loaded by overview-load.ts, drawn by components/clients/
// profile/overview/. No Supabase here — importable by node --test.

import { daysUntil, formatDate, todayYmd } from "./dates.ts";
import type { AttentionItem, CodePace } from "./readiness.ts";
import type { ClientProfileSection } from "./profile-sections.ts";

export type ComingUpItem = {
  key: string;
  label: string;
  /** YYYY-MM-DD */
  date: string;
  days: number;
  /** Shift start time (ISO) when it's a shift. */
  startsAt: string | null;
  section: ClientProfileSection;
};

export type OverviewTeamMember = {
  id: string;
  name: string;
  codes: string[];
  /** Same rules as Team Members readiness (staffClientReadiness). */
  readyAlone: boolean;
  readinessLabel: string;
};

export type OverviewNote = {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  kind: "shift" | "daily";
  code: string | null;
  /** Who wrote it: the punch's team member, or the daily log's author. */
  author: string | null;
  text: string;
};

export type ClientOverview = {
  attention: AttentionItem[];
  paces: CodePace[];
  mustKnows: string | null;
  comingUp: ComingUpItem[];
  team: OverviewTeamMember[];
  lastNotes: OverviewNote[];
};

export const clientOverviewKey = (orgId: string | undefined, clientId: string) =>
  ["client-overview", orgId, clientId] as const;

/** Days ahead the Coming up card looks. */
export const COMING_UP_DAYS = 30;
export const COMING_UP_LIMIT = 6;
export const LAST_NOTES_LIMIT = 4;

/** The collapsed "Needs attention (N)" button: danger when any item blocks, amber otherwise. */
export function attentionSummary(
  items: readonly AttentionItem[],
): { count: number; tone: "danger" | "profile" } | null {
  if (!items.length) return null;
  return { count: items.length, tone: items.some((i) => i.tone === "bad") ? "danger" : "profile" };
}

/** "Today, 9:00 AM", "Tomorrow, 9:00 AM", "Tue, Oct 8, 9:00 AM"; due dates without a time. */
export function comingUpWhen(i: ComingUpItem): string {
  const day =
    i.days === 0
      ? "Today"
      : i.days === 1
        ? "Tomorrow"
        : formatDate(i.date, { weekday: "short", month: "short", day: "numeric" });
  if (!i.startsAt) return i.days < 0 ? `${formatDate(i.date)} (overdue)` : day;
  const time = new Date(i.startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

/** The line above a note: "Sam Test · Oct 4, 2026 · SLN shift note". */
export function noteHeading(n: OverviewNote): string {
  const what = n.kind === "daily" ? "Daily note" : `${n.code ?? "Shift"} shift note`;
  return [n.author ?? "Unknown author", formatDate(n.date), what].join(" · ");
}

/** Shifts and due dates in the next COMING_UP_DAYS (overdue due dates kept), soonest first. */
export function comingUpItems(
  args: {
    shifts: readonly {
      id: string;
      starts_at: string;
      service_code: string | null;
      staffName: string | null;
    }[];
    due: readonly {
      key: string;
      label: string;
      date: string | null;
      section: ClientProfileSection;
    }[];
  },
  now: Date = new Date(),
): ComingUpItem[] {
  const out: ComingUpItem[] = [];
  for (const s of args.shifts) {
    const date = todayYmd(new Date(s.starts_at));
    const days = daysUntil(date, now);
    if (days == null || days < 0 || days > COMING_UP_DAYS) continue;
    const who = s.staffName ? ` with ${s.staffName}` : " (open)";
    out.push({
      key: `shift:${s.id}`,
      label: `${s.service_code ?? "Shift"}${who}`,
      date,
      days,
      startsAt: s.starts_at,
      section: "activity",
    });
  }
  for (const d of args.due) {
    const days = daysUntil(d.date, now);
    if (days == null || !d.date || days > COMING_UP_DAYS) continue;
    out.push({
      key: d.key,
      label: d.label,
      date: d.date.slice(0, 10),
      days,
      startsAt: null,
      section: d.section,
    });
  }
  return out
    .sort((a, b) => a.days - b.days || (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    .slice(0, COMING_UP_LIMIT);
}

/** Newest notes first, blank ones dropped, trimmed to a short preview. */
export function lastNotes(
  notes: readonly OverviewNote[],
  limit = LAST_NOTES_LIMIT,
): OverviewNote[] {
  return notes
    .filter((n) => n.text.trim().length > 0)
    .map((n) => ({
      ...n,
      text: n.text.trim().length > 240 ? `${n.text.trim().slice(0, 237)}…` : n.text.trim(),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
