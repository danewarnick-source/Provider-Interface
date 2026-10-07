// The optional "Finish setting up <first name>" steps after Add client: their
// order, labels, where each one is kept on the profile, and the closing
// summary (what's set up, what was skipped and where to add it later).
// Pure, importable by node --test.

import type { ClientProfileSection } from "./profile-sections.ts";

export const SETUP_STEPS = ["about", "contacts", "health", "team", "behavior", "file"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
export type StepOutcome = "done" | "skipped";

export const SETUP_STEP: Record<SetupStep, { label: string; section: ClientProfileSection }> = {
  about: { label: "About", section: "profile" },
  contacts: { label: "Contacts", section: "contacts" },
  health: { label: "Health", section: "health" },
  team: { label: "Team", section: "team" },
  behavior: { label: "Behavior", section: "plans" },
  file: { label: "Client file", section: "file" },
};

/** The step after this one; null after the last. */
export function nextSetupStep(step: SetupStep): SetupStep | null {
  return SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1] ?? null;
}

/** The step before this one; null on the first. */
export function previousSetupStep(step: SetupStep): SetupStep | null {
  const i = SETUP_STEPS.indexOf(step);
  return i > 0 ? SETUP_STEPS[i - 1] : null;
}

/** "Step 3 of 6". */
export function stepCounter(step: SetupStep): string {
  return `Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`;
}

export type SummaryLine = {
  step: SetupStep;
  label: string;
  done: boolean;
  /** "Set up" or "Skipped: add it later in Health". */
  text: string;
  section: ClientProfileSection;
  /** Button to where it's added later; null when it was set up. */
  linkLabel: string | null;
};

/** One line per step. A step never reached counts as skipped. */
export function setupSummary(
  outcomes: Partial<Record<SetupStep, StepOutcome>>,
  sectionLabel: (section: ClientProfileSection) => string,
): SummaryLine[] {
  return SETUP_STEPS.map((step) => {
    const { label, section } = SETUP_STEP[step];
    const done = outcomes[step] === "done";
    const where = sectionLabel(section);
    return {
      step,
      label,
      done,
      text: done ? "Set up" : `Skipped: add it later in ${where}`,
      section,
      linkLabel: done ? null : `Open ${where}`,
    };
  });
}

/** The banner on the profile while setup is open. */
export function setupBannerText(firstName: string): { title: string; line: string } {
  const name = firstName.trim() || "this client";
  return {
    title: `Finish setting up ${name}`,
    line: "A few short questions: photo, contacts, health, team, behavior and the client file. Skip anything; it saves as you go.",
  };
}
