import { EVIDENCE_SUBJECTS, type EvidenceSubject } from "./types.ts";

export const EVIDENCE_STEPS = ["grid", "pack", "quiz", "newtype", "review"] as const;
export type EvidenceStep = (typeof EVIDENCE_STEPS)[number];

export const EVIDENCE_STEP_LABEL: Record<EvidenceStep, string> = {
  grid: "Grid",
  pack: "Pack settings",
  quiz: "Hire questionnaire",
  newtype: "Add requirement",
  review: "Review file",
};

export type EvidenceSearch = {
  tab?: string;
  step?: string;
  person?: string;
  item?: string;
  wizard?: boolean;
};

const SUBJECT_ALIASES: Record<string, EvidenceSubject> = {
  staff: "staff",
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
    ...(step ? { step } : {}),
    ...(person ? { person } : {}),
    ...(item ? { item } : {}),
    ...(wizard ? { wizard: true } : {}),
  };
}

export function resolveEvidenceTab(tab?: string): EvidenceSubject {
  const key = (tab ?? "").trim().toLowerCase();
  return SUBJECT_ALIASES[key] ?? "staff";
}

export function resolveEvidenceStep(step?: string): EvidenceStep {
  const key = (step ?? "").trim().toLowerCase();
  return (EVIDENCE_STEPS as readonly string[]).includes(key) ? (key as EvidenceStep) : "grid";
}

export function evidenceSearchFor(args: {
  tab?: EvidenceSubject;
  step?: EvidenceStep;
  person?: string | null;
  item?: string | null;
  wizard?: boolean;
}): EvidenceSearch {
  return {
    tab: args.tab ?? "staff",
    ...(args.step && args.step !== "grid" ? { step: args.step } : {}),
    ...(args.person ? { person: args.person } : {}),
    ...(args.item ? { item: args.item } : {}),
    ...(args.wizard ? { wizard: true } : {}),
  };
}

export function isEvidenceSubject(value: string): value is EvidenceSubject {
  return (EVIDENCE_SUBJECTS as readonly string[]).includes(value);
}
