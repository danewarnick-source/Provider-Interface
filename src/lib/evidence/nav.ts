import { EVIDENCE_SUBJECTS, type EvidenceSubject } from "./types.ts";

export const EVIDENCE_STEPS = ["grid", "quiz", "review"] as const;
export type EvidenceStep = (typeof EVIDENCE_STEPS)[number];

export const EVIDENCE_STEP_ALIASES: Record<string, EvidenceStep> = {
  grid: "grid",
  roster: "grid",
  quiz: "quiz",
  pack: "quiz",
  newtype: "quiz",
  wizard: "quiz",
  review: "review",
};

export type EvidenceSearch = {
  tab?: string;
  step?: string;
  person?: string;
  item?: string;
};

const SUBJECT_ALIASES: Record<string, EvidenceSubject> = {
  staff: "staff",
  employee: "staff",
  employees: "staff",
  client: "client",
  clients: "client",
  company: "company",
  agency: "company",
};

export function parseEvidenceSearch(s: Record<string, unknown>): EvidenceSearch {
  const tab = typeof s.tab === "string" ? s.tab.trim() : "";
  const step = typeof s.step === "string" ? s.step.trim() : "";
  const person = typeof s.person === "string" ? s.person.trim() : "";
  const item = typeof s.item === "string" ? s.item.trim() : "";
  const wizard = s.wizard === "1" || s.wizard === 1 || s.wizard === true || s.wizard === "true";
  return {
    ...(tab ? { tab } : {}),
    ...(step ? { step } : wizard ? { step: "quiz" } : {}),
    ...(person ? { person } : {}),
    ...(item ? { item } : {}),
  };
}

export function resolveEvidenceTab(tab?: string): EvidenceSubject {
  const key = (tab ?? "").trim().toLowerCase();
  return SUBJECT_ALIASES[key] ?? "staff";
}

export function resolveEvidenceStep(step?: string): EvidenceStep {
  const key = (step ?? "").trim().toLowerCase();
  return EVIDENCE_STEP_ALIASES[key] ?? "grid";
}

export function evidenceSearchFor(args: {
  tab?: EvidenceSubject;
  step?: EvidenceStep;
  person?: string | null;
  item?: string | null;
}): EvidenceSearch {
  return {
    tab: args.tab ?? "staff",
    ...(args.step && args.step !== "grid" ? { step: args.step } : {}),
    ...(args.person ? { person: args.person } : {}),
    ...(args.item ? { item: args.item } : {}),
  };
}

/** Leave Add / quiz / packs: list-only URL, no leftover person panel. */
export function leaveEvidenceWizard(tab: EvidenceSubject): EvidenceSearch {
  return evidenceSearchFor({ tab, step: "grid", person: null, item: null });
}

export function isEvidenceSubject(value: string): value is EvidenceSubject {
  return (EVIDENCE_SUBJECTS as readonly string[]).includes(value);
}
