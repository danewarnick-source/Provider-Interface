// The model call's prompt, built on the trust layer (lib/nectar-trust.ts)
// (N5, Decision 8). Pure, so node --test can import it.
//
// Every source is wrapped as untrusted data under a short id (s1, s2, ...)
// that is not part of the data. The model answers only from the sources,
// cites them as [S:<id>], says it couldn't find the answer otherwise, and
// adds nothing that is not in a source.

import {
  UNTRUSTED_DOCUMENT_RULE,
  delimitUntrustedDocument,
  orgBoundaryRule,
} from "../../nectar-trust.ts";
import type { AskView, NectarSourceKind, SourceCandidate } from "./ask-types.ts";

/** Longest source text sent to the model; longer text is cut with "…". */
export const MAX_SOURCE_CHARS = 3_000;

export interface LabeledSource extends SourceCandidate {
  /** The id the model cites: s1, s2, ... */
  label: string;
}

const KIND_LABEL: Record<NectarSourceKind, string> = {
  library: "agency document",
  state_rule: "state rule",
  client_plan: "client plan",
  medications: "client medications",
  schedule: "the asker's own published shifts",
  agency: "agency facts",
};

export function labelSources(candidates: readonly SourceCandidate[]): LabeledSource[] {
  return candidates.map((c, i) => ({ ...c, label: `s${i + 1}` }));
}

function clip(text: string): string {
  const t = text.trim();
  return t.length > MAX_SOURCE_CHARS ? `${t.slice(0, MAX_SOURCE_CHARS - 1)}…` : t;
}

/** One source block: the id outside the untrusted data, the title and text inside it. */
export function sourceBlock(s: LabeledSource): string {
  const { documentTitle, heading, version } = s.source;
  const lines = [
    `Title: ${documentTitle}${version ? ` (version ${version})` : ""}`,
    heading ? `Section: ${heading}` : null,
    "",
    clip(s.text),
  ].filter((l) => l !== null);
  return `Source [S:${s.label}] (${KIND_LABEL[s.source.kind]}):\n${delimitUntrustedDocument(lines.join("\n"))}`;
}

export function buildSystemPrompt(opts: {
  orgId: string;
  orgName: string;
  view: AskView;
  sources: readonly LabeledSource[];
  notFound: string;
}): string {
  const asker = opts.view === "admin" ? "an owner or admin" : "a team member";
  const rules = [
    "Use only the sources below. Never add facts, numbers, names, dates, steps or advice that are not in them, and never use outside knowledge.",
    "Cite every statement with the id of the source it came from, written as [S:s1]. Use only the ids listed below, and do not add a list of sources at the end.",
    `If the sources do not answer the question, reply with exactly this sentence and nothing else: ${opts.notFound}`,
    'Answer in plain English, briefly: a few sentences or a short list. Say "team member" and "client".',
    "You give information, not rulings. If the question asks for a decision, give what the sources say and suggest asking a supervisor.",
  ];
  if (opts.view === "staff") {
    rules.push(
      "Never discuss pay, hours worked, billing, other team members, or any client who is not in the sources.",
    );
  }
  return [
    `You are Nectar, the AI assistant in Provider Interface. You answer one question from ${asker} at ${opts.orgName}, using only the sources below.`,
    UNTRUSTED_DOCUMENT_RULE,
    orgBoundaryRule(opts.orgId, opts.orgName),
    `How to answer:\n${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
    `Sources:\n\n${opts.sources.map(sourceBlock).join("\n\n")}`,
  ].join("\n\n");
}

/** The user turn: the question, as asked. */
export function buildUserMessage(question: string): string {
  return `Question: ${question.trim()}`;
}
