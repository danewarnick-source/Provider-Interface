// What the agency does for one client (client_support_scope), from the
// optional "Finish setting up" steps, and which profile cards that hides.
// A null answer means "not asked yet": the card shows. Hidden cards are left
// out of the page (not shown empty) and never count in Needs attention; an
// admin can turn one back on from "Show hidden sections". Pure, importable
// by node --test.

import type { ClientProfileSection } from "./profile-sections.ts";

export type SupportScope = {
  helps_with_medications: boolean | null;
  helps_with_appointments: boolean | null;
  has_advance_directive: boolean | null;
  has_bsp: boolean | null;
  no_photo: boolean | null;
  setup_started_at: string | null;
  setup_finished_at: string | null;
};

export const SCOPE_ANSWERS = [
  "helps_with_medications",
  "helps_with_appointments",
  "has_advance_directive",
  "has_bsp",
  "no_photo",
] as const;
export type ScopeAnswer = (typeof SCOPE_ANSWERS)[number];
export type ScopeAnswers = Partial<Record<ScopeAnswer, boolean | null>>;

export const SUPPORT_SCOPE_COLUMNS = [...SCOPE_ANSWERS, "setup_started_at", "setup_finished_at"].join(
  ", ",
);

export type ScopeCard = "photo" | "medications" | "health_events" | "advance_directive" | "bsp";

type CardDef = {
  label: string;
  section: ClientProfileSection;
  answer: ScopeAnswer;
  /** The answer that shows the card again. */
  showWith: boolean;
  /** Why it's hidden, in plain words. */
  why: string;
};

export const SCOPE_CARDS: Record<ScopeCard, CardDef> = {
  photo: {
    label: "Photo",
    section: "profile",
    answer: "no_photo",
    showWith: false,
    why: "The person prefers no photo.",
  },
  medications: {
    label: "Medications",
    section: "health",
    answer: "helps_with_medications",
    showWith: true,
    why: "Your agency doesn't help with medications.",
  },
  health_events: {
    label: "Health events and appointments",
    section: "health",
    answer: "helps_with_appointments",
    showWith: true,
    why: "Family handles doctor visits.",
  },
  advance_directive: {
    label: "Advance directive",
    section: "health",
    answer: "has_advance_directive",
    showWith: true,
    why: "No advance directive or DNR.",
  },
  bsp: {
    label: "Behavior support plan",
    section: "plans",
    answer: "has_bsp",
    showWith: true,
    why: "No behavior support plan.",
  },
};

const CARD_ORDER: readonly ScopeCard[] = [
  "photo",
  "medications",
  "health_events",
  "advance_directive",
  "bsp",
];

/** Facts from the record that keep a card on screen whatever the answer. */
export type ScopeFacts = {
  /** BC1–BC3 from us or another agency (bsp.ts needsBehaviorSupportPlan). */
  needsBsp: boolean;
  /** A DNR or POLST is recorded on the client. */
  directiveOnFile: boolean;
};

export const NO_FACTS: ScopeFacts = { needsBsp: false, directiveOnFile: false };

/** Does this card show for this client? */
export function cardShows(
  card: ScopeCard,
  scope: Partial<SupportScope> | null | undefined,
  facts: ScopeFacts = NO_FACTS,
): boolean {
  const s = scope ?? {};
  switch (card) {
    case "photo":
      return s.no_photo !== true;
    case "medications":
      return s.helps_with_medications !== false;
    case "health_events":
      return s.helps_with_appointments !== false;
    case "advance_directive":
      return s.has_advance_directive !== false || facts.directiveOnFile;
    case "bsp":
      return s.has_bsp === true || (facts.needsBsp && s.has_bsp !== false);
  }
}

/** Hidden by an answer. A BSP card only counts when the codes would otherwise show it. */
function hiddenByAnswer(
  card: ScopeCard,
  scope: Partial<SupportScope> | null | undefined,
  facts: ScopeFacts,
): boolean {
  if (card === "bsp" && !facts.needsBsp) return false;
  return !cardShows(card, scope, facts);
}

/** Cards in a section hidden by an answer ("Show hidden sections (N)"). */
export function hiddenCards(
  section: ClientProfileSection,
  scope: Partial<SupportScope> | null | undefined,
  facts: ScopeFacts = NO_FACTS,
): ScopeCard[] {
  return CARD_ORDER.filter(
    (card) => SCOPE_CARDS[card].section === section && hiddenByAnswer(card, scope, facts),
  );
}

/** Every hidden card on the profile (Needs attention leaves these out). */
export function allHiddenCards(
  scope: Partial<SupportScope> | null | undefined,
  facts: ScopeFacts = NO_FACTS,
): ScopeCard[] {
  return CARD_ORDER.filter((card) => hiddenByAnswer(card, scope, facts));
}

/** The answer that turns a hidden card back on. */
export function showAgainAnswers(card: ScopeCard): ScopeAnswers {
  const def = SCOPE_CARDS[card];
  return { [def.answer]: def.showWith };
}

/** "Finish setting up" shows from Add client until the steps are finished. */
export function setupPending(scope: Partial<SupportScope> | null | undefined): boolean {
  return !!scope?.setup_started_at && !scope.setup_finished_at;
}

/** Only known answer keys with boolean or null values. */
export function cleanAnswers(raw: Record<string, unknown>): ScopeAnswers {
  const out: ScopeAnswers = {};
  for (const key of SCOPE_ANSWERS) {
    const v = raw[key];
    if (typeof v === "boolean" || v === null) out[key] = v;
  }
  return out;
}
