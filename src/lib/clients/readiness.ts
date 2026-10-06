// The one "needs attention" calculation for a client. Pure: the Overview,
// the section badges and the Smart Import done page all read its output.
// Covers units pacing, documents due or missing (photo older than 5 years
// included), plan-year reminders (60 / 30 days before the end), PCSP waiting
// (with the office follow-up from day 10), support strategies due (plan
// activation + 30 days), summaries due, HRC reviews and finish-setup gaps.
// Advisory only: it never blocks a save.

import { listReadiness } from "./list.ts";
import { daysUntil, parseLocalDate } from "./dates.ts";
import { addDaysYmd, planReminder, strategiesDueOn } from "./plan-dates.ts";
import { currentPlan, type ClientPlan } from "./plans.ts";
import type { ClientProfileSection } from "./profile-sections.ts";

export type AttentionTone = "bad" | "warn";

export type AttentionItem = {
  key: string;
  title: string;
  detail: string;
  tone: AttentionTone;
  /** The profile section that fixes it. */
  section: ClientProfileSection;
};

/** Units used against one authorization, with today's expected pace. */
export type CodePace = {
  code: string;
  annual: number;
  used: number;
  left: number;
  /** Share of the authorization left, 0–100. */
  leftPct: number;
  /** Share of the authorization window gone by today, 0–100 (the pace marker). */
  elapsedPct: number;
  /** Share of the authorization used, 0–100. */
  usedPct: number;
  pending: boolean;
  start: string | null;
  end: string | null;
};

/** Photos older than this need retaking. */
export const PHOTO_MAX_YEARS = 5;
/** Share left (percent) that counts as running out. */
export const UNITS_LOW_PCT = 10;
/** Points over pace (used% − elapsed%) that count as using units too fast. */
export const OVER_PACE_POINTS = 10;
/** Days before a due date that the Overview starts flagging it. */
export const ATTENTION_DUE_DAYS = 14;

const DAY_MS = 86_400_000;

/** Pace for one code. No end date: the window is one year from the start. */
export function codePace(
  row: {
    service_code: string;
    service_start_date: string | null;
    service_end_date: string | null;
    annual_unit_authorization: number | null;
    authorization_pending?: boolean | null;
  },
  used: number,
  now: Date = new Date(),
): CodePace {
  const annual = Math.max(0, row.annual_unit_authorization ?? 0);
  const left = Math.max(0, annual - used);
  const start = parseLocalDate(row.service_start_date);
  const endYmd =
    row.service_end_date ?? (row.service_start_date ? addDaysYmd(row.service_start_date, 364) : null);
  const end = parseLocalDate(endYmd);
  let elapsedPct = 0;
  if (start && end && end > start) {
    const total = end.getTime() - start.getTime() + DAY_MS;
    elapsedPct = Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / total) * 100));
  }
  return {
    code: row.service_code,
    annual,
    used,
    left,
    leftPct: annual > 0 ? (left / annual) * 100 : 0,
    elapsedPct,
    usedPct: annual > 0 ? Math.min(100, (used / annual) * 100) : 0,
    pending: row.authorization_pending === true,
    start: row.service_start_date,
    end: endYmd,
  };
}

/** Is the photo missing or older than PHOTO_MAX_YEARS? Unknown date = not flagged. */
export function photoStatus(
  photo: { url: string | null; takenOn: string | null },
  now: Date = new Date(),
): "ok" | "missing" | "old" {
  if (!photo.url) return "missing";
  const taken = parseLocalDate(photo.takenOn);
  if (!taken) return "ok";
  const limit = new Date(taken);
  limit.setFullYear(limit.getFullYear() + PHOTO_MAX_YEARS);
  return now >= limit ? "old" : "ok";
}

export type ReadinessInput = {
  codes: readonly string[];
  paces: readonly CodePace[];
  /** Client file cards (file.ts) other than photo, strategies and summaries. */
  fileCards: readonly { key: string; title: string; status: string; dueAt: string | null }[];
  photo: { url: string | null; takenOn: string | null };
  plans: readonly ClientPlan[];
  /** null when the client's codes don't need support strategies. */
  strategies: { published: boolean } | null;
  summaries: readonly { label: string; dueDate: string | null }[];
  restrictions: readonly { title: string; nextReview: string | null; complete: boolean }[];
  setup: { staffCount: number; hasPin: boolean; guardianOk: boolean };
};

function dueText(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

/** Everything that needs attention, worst first. */
export function clientAttention(input: ReadinessInput, now: Date = new Date()): AttentionItem[] {
  const out: AttentionItem[] = [];
  const add = (item: AttentionItem) => out.push(item);

  for (const gap of listReadiness({ codes: input.codes, ...input.setup }).missing) {
    const section: ClientProfileSection = /team member/i.test(gap)
      ? "team"
      : /pin/i.test(gap)
        ? "profile"
        : /guardian/i.test(gap)
          ? "contacts"
          : "services";
    add({ key: `setup:${gap}`, title: "Finish setup", detail: gap, tone: "bad", section });
  }

  for (const p of input.paces) {
    if (p.pending) {
      add({
        key: `units:${p.code}`,
        title: `${p.code} waiting on 1056`,
        detail: "Units aren't on file yet",
        tone: "warn",
        section: "services",
      });
    } else if (p.annual > 0 && p.leftPct <= UNITS_LOW_PCT) {
      add({
        key: `units:${p.code}`,
        title: `${p.code} units running out`,
        detail: `${p.left} of ${p.annual} left`,
        tone: "bad",
        section: "services",
      });
    } else if (p.annual > 0 && p.usedPct - p.elapsedPct >= OVER_PACE_POINTS) {
      add({
        key: `units:${p.code}`,
        title: `${p.code} ahead of pace`,
        detail: `${Math.round(p.usedPct)}% used, ${Math.round(p.elapsedPct)}% of the year gone`,
        tone: "warn",
        section: "services",
      });
    }
  }

  const photo = photoStatus(input.photo, now);
  if (photo !== "ok") {
    add({
      key: "photo",
      title: photo === "missing" ? "Photo missing" : "Photo is over 5 years old",
      detail: photo === "missing" ? "Add a current photo" : "Take a new photo",
      tone: "warn",
      section: "profile",
    });
  }

  for (const card of input.fileCards) {
    if (card.status !== "missing" && card.status !== "due_soon") continue;
    const days = daysUntil(card.dueAt, now);
    add({
      key: `file:${card.key}`,
      title: card.title,
      detail:
        card.status === "missing"
          ? days != null && days < 0
            ? dueText(days)
            : "Missing"
          : dueText(days ?? 0),
      tone: card.status === "missing" ? "bad" : "warn",
      section: "file",
    });
  }

  const reminder = planReminder(input.plans, now);
  if (reminder?.kind === "waiting") {
    const d = reminder.days;
    add({
      key: "pcsp-waiting",
      title: reminder.officeTask ? "Office: follow up on the new PCSP" : "Waiting on the new PCSP",
      detail: `${d} day${d === 1 ? "" : "s"} since the plan year ended`,
      tone: reminder.officeTask ? "bad" : "warn",
      section: "plans",
    });
  } else if (reminder?.kind === "ending") {
    add({
      key: `plan-ending:${reminder.threshold}`,
      title: "Plan year ending — schedule the PCSP meeting",
      detail: `Ends in ${reminder.days} day${reminder.days === 1 ? "" : "s"}`,
      tone: "warn",
      section: "plans",
    });
  }

  if (input.strategies && !input.strategies.published) {
    const days = daysUntil(strategiesDueOn(currentPlan(input.plans, now)), now);
    add({
      key: "strategies",
      title: "Support strategies not published",
      detail: days == null ? "Add the plan's activation date" : dueText(days),
      tone: days != null && days < 0 ? "bad" : "warn",
      section: "plans",
    });
  }

  for (const s of input.summaries) {
    const days = daysUntil(s.dueDate, now);
    if (days == null || days > ATTENTION_DUE_DAYS) continue;
    add({
      key: `summary:${s.label}:${s.dueDate}`,
      title: `Summary ${s.label}`,
      detail: dueText(days),
      tone: days < 0 ? "bad" : "warn",
      section: "plans",
    });
  }

  for (const r of input.restrictions) {
    const days = daysUntil(r.nextReview, now);
    if (!r.complete) {
      add({
        key: `hrc:${r.title}`,
        title: `Rights restriction: ${r.title}`,
        detail: "Documentation incomplete",
        tone: "bad",
        section: "plans",
      });
    } else if (days != null && days <= ATTENTION_DUE_DAYS) {
      add({
        key: `hrc:${r.title}`,
        title: `HRC review: ${r.title}`,
        detail: dueText(days),
        tone: days < 0 ? "bad" : "warn",
        section: "plans",
      });
    }
  }

  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));
}

/** Count of items per section (for the side-menu badges). */
export function attentionBySection(
  items: readonly AttentionItem[],
): Map<ClientProfileSection, number> {
  const out = new Map<ClientProfileSection, number>();
  for (const i of items) out.set(i.section, (out.get(i.section) ?? 0) + 1);
  return out;
}
