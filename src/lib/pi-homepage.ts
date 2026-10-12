/**
 * Public marketing homepage tokens and copy.
 * Colors are the Denim design system (light): the same numbers as the
 * --denim-* CSS variables, read from DENIM so they cannot drift. The CSS in
 * pi-homepage.css uses the variables; these mirror them for tests / JS.
 */

import { DENIM, DENIM_FONTS, DENIM_STATUS } from "./design-tokens.ts";

/** Footer + dark band navy. */
export const PI_HOME_NAVY = DENIM.deep;
export const PI_HOME_NAVY2 = DENIM.pri;
export const PI_HOME_PANEL = DENIM.paper;
export const PI_HOME_LINE = DENIM.line;
export const PI_HOME_INK = DENIM.deep;
export const PI_HOME_INK2 = DENIM.text;
export const PI_HOME_INK3 = DENIM.muted;
/** Denim green accent (eyebrows, checks, key numbers). */
export const PI_HOME_ACCENT = DENIM.acc;
export const PI_HOME_ACCENT_TEXT = DENIM.accd;
export const PI_HOME_ACCENT_SOFT = DENIM.acct;
export const PI_HOME_OK = DENIM.accd;
export const PI_HOME_WARN = DENIM_STATUS.warnText;
export const PI_HOME_BAD = DENIM_STATUS.dangerText;
export const PI_HOME_PILL_OK = DENIM.acct;
export const PI_HOME_PILL_WARN = DENIM_STATUS.warnBg;
export const PI_HOME_PILL_BAD = DENIM_STATUS.dangerBg;
export const PI_HOME_PILL_MUTE = DENIM.pt;
/** Primary pill (Get started / Sign in on paper). */
export const PI_HOME_PRIMARY_BTN = DENIM.pri;
/** Floating glass nav pill background. */
export const PI_HOME_NAV_BG = "rgba(255, 255, 255, 0.72)";

/** Headings (Manrope). */
export const PI_HOME_DISPLAY = DENIM_FONTS.heading;
/** Body / UI (Figtree). */
export const PI_HOME_SANS = DENIM_FONTS.body;

export const PI_HOME_BODY_BG = DENIM.bg;

export const PI_HOME_MAX_WIDTH = 1240;
/** Pills: buttons, nav, badges are fully rounded. */
export const PI_HOME_BTN_RADIUS = 999;
export const PI_HOME_NAV_BREAKPOINT = 820;
/** Desktop side inset. Shared landing `section { padding: 0 }` must not win. */
export const PI_HOME_GUTTER_PX = 32;

export const PI_HOME_EYEBROW = "Already standing the day you sign in.";
export const PI_HOME_H1_LEAD = "You focus on what's important";
export const PI_HOME_H1_TO = "to";
export const PI_HOME_H1_MID = "your business,";
export const PI_HOME_H1_BUILT = "We focus on what's important";
export const PI_HOME_H1_FOR = "for";
export const PI_HOME_H1_TAIL = "your business";
export const PI_HOME_SEE_IT = "See it in 10 minutes";
export const PI_HOME_HOW_NECTAR = "How Nectar works";
export const PI_HOME_HERO_FINE = "$69/client · $350 min";
export const PI_HOME_START_SIGNUP = "Start signup";

/** Locked Utah line — keep as written. Flagged in the PR. */
export const PI_HOME_UTAH_LINE = "Built for Utah Medicaid disability providers";
export const PI_HOME_DSP_CAPTION =
  "Direct support professionals clock in. The office already knows the rest.";

export const PI_HOME_PRICING_KICKER = "Pricing";
export const PI_HOME_PRICING_HEADLINE = "One number. Whole platform.";
export const PI_HOME_PRICING_UNIT = "per client / month";
export const PI_HOME_PRICING_MIN = "$350 / month minimum. No setup fee. No feature tiers.";

export const PI_HOME_FOOTER_HCBS =
  "Operations software for home and community-based services (HCBS) providers. One office for people, the schedule, notes, trainings, and Nectar.";

export const PI_HOME_PRIVACY = "Privacy";
export const PI_HOME_TERMS = "Terms";
export const PI_HOME_CONTACT = "Contact";

export const PI_HOME_NAV = [
  { label: "Nectar", to: "/" as const, hash: "nectar" },
  { label: "Training", to: "/" as const, hash: "training" },
  { label: "Pricing", to: "/" as const, hash: "pricing" },
  { label: "About", to: "/about" as const, hash: undefined },
] as const;

/** Same labels and order as the homepage, pointed at dedicated public routes. */
export const PI_PUBLIC_NAV = [
  { label: "Nectar", to: "/nectar" as const },
  { label: "Pricing", to: "/pricing" as const },
  { label: "About", to: "/about" as const },
] as const;

export const PI_HOME_FOOTER_LINKS = [
  { label: PI_HOME_PRIVACY, to: "/privacy" as const },
  { label: PI_HOME_TERMS, to: "/terms" as const },
  { label: PI_HOME_CONTACT, to: "/contact" as const },
] as const;

export const PI_HOME_FEATURES = [
  {
    id: "notes",
    kicker: "Notes",
    title: "Notes already written.",
    body: "Nectar reviews every shift note before staff clock out. It checks the support given and how the person responded — and knows what each service code requires. Staff fix it on the spot, not you later.",
    reverse: false,
  },
  {
    id: "nectar",
    kicker: "Nectar Ask",
    title: "A second set of eyes on the day.",
    body: "Ask Nectar while the day is still happening. It offers a sentence, a flag, a next step. You stay in charge. Drafts stay drafts until you say they are done. Nothing publishes itself.",
    reverse: true,
  },
  {
    id: "training",
    kicker: "Training",
    title: "Trainings in the room.",
    body: "Assigned work, finished work, the packet you would otherwise assemble by hand — already next to the people they belong to. Optional classes are sold separately. The platform has no feature tiers.",
    reverse: false,
  },
] as const;

export const PI_HOME_PHONE_ROWS = [
  { label: "Evening note", value: "Complete", tone: "ok" as const },
  { label: "CPR renewal", value: "12 days", tone: "warn" as const },
  { label: "Auth remaining", value: "Thin", tone: "bad" as const },
  { label: "Coverage", value: "Standing", tone: "ok" as const },
  { label: "30-day course", value: "Assigned", tone: "mute" as const },
] as const;

export const PI_HOME_CHIPS = ["Nectar", "Notes written", "$69"] as const;

export const PI_HOME_ASK = [
  {
    who: "you" as const,
    text: "What does tonight's note still need before Justin's shift can close?",
  },
  {
    who: "nectar" as const,
    text: "Name the goals worked on and how Justin responded. Add whether evening medications were given.",
  },
] as const;

export const PI_HOME_TRAINING_ROWS = [
  { name: "CPR / First Aid", state: "Current", tone: "ok" as const },
  { name: "30-day orientation", state: "In progress", tone: "warn" as const },
  { name: "Mandt", state: "Assigned", tone: "mute" as const },
] as const;

export const PI_PRIVACY_TITLE = "Privacy";
export const PI_PRIVACY_INTRO =
  "This is how Provider Interface LLC treats information you put in the product.";
export const PI_PRIVACY_PARAS = [
  "We use the information you enter to run the office you signed up for — people, the schedule, notes, trainings, and billing. We do not sell it.",
  "Some of that information is protected health information. The Business Associate Agreement on this site is how that is covered.",
  "Questions: use the contact page. The company is Provider Interface LLC.",
] as const;
