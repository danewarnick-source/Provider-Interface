// Caseload tab on the team member profile — pure draft math. The tab keeps a
// draft of { clientId → explicit codes } and saves each changed client through
// setStaffClientCodes (the single write path). No I/O here.

import { suggestedRequirementKeys } from "../evidence/catalog.ts";
import {
  answersForPeople,
  type CaseloadFacts,
  type EvidencePersonFacts,
} from "./evidence-answers.ts";

/** clientId → the codes this person is assigned for that client. */
export type CaseloadDraft = Readonly<Record<string, readonly string[]>>;

export type CaseloadChange = {
  clientId: string;
  /** What setStaffClientCodes receives. [] removes the client. */
  codes: string[];
  kind: "added" | "changed" | "removed";
};

export const REMOVED_FROM_CASELOAD_REASON = "Removed from caseload";

function sameCodes(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((c) => set.has(c));
}

/** Only authorized codes survive, in the client's authorized order. */
function withinAuthorized(codes: Iterable<string>, authorized: readonly string[]): string[] {
  const want = new Set(codes);
  return authorized.filter((c) => want.has(c));
}

/** Every client whose codes differ between what's saved and the draft. */
export function caseloadChanges(saved: CaseloadDraft, draft: CaseloadDraft): CaseloadChange[] {
  const out: CaseloadChange[] = [];
  const ids = new Set([...Object.keys(saved), ...Object.keys(draft)]);
  for (const clientId of ids) {
    const before = saved[clientId] ?? [];
    const after = draft[clientId] ?? [];
    if (sameCodes(before, after)) continue;
    const kind = after.length === 0 ? "removed" : before.length === 0 ? "added" : "changed";
    out.push({ clientId, codes: [...after], kind });
  }
  return out.sort((a, b) => a.clientId.localeCompare(b.clientId));
}

export function hasCaseloadChanges(saved: CaseloadDraft, draft: CaseloadDraft): boolean {
  return caseloadChanges(saved, draft).length > 0;
}

/** Add a client with all of its authorized codes pre-checked. */
export function addClientToDraft(
  draft: CaseloadDraft,
  clientId: string,
  authorized: readonly string[],
): CaseloadDraft {
  return { ...draft, [clientId]: [...authorized] };
}

/** Remove a client from the draft (saves as codes = []). */
export function removeClientFromDraft(draft: CaseloadDraft, clientId: string): CaseloadDraft {
  const next = { ...draft };
  delete next[clientId];
  return next;
}

/** Toggle one code within the client's authorized codes. */
export function toggleDraftCode(
  draft: CaseloadDraft,
  clientId: string,
  code: string,
  authorized: readonly string[],
): CaseloadDraft {
  if (!authorized.includes(code)) return draft;
  const cur = new Set(draft[clientId] ?? []);
  if (cur.has(code)) cur.delete(code);
  else cur.add(code);
  return { ...draft, [clientId]: withinAuthorized(cur, authorized) };
}

/** "Select all": every authorized code, or none when all are already checked. */
export function selectAllDraftCodes(
  draft: CaseloadDraft,
  clientId: string,
  authorized: readonly string[],
): CaseloadDraft {
  const cur = draft[clientId] ?? [];
  const all = authorized.length > 0 && authorized.every((c) => cur.includes(c));
  return { ...draft, [clientId]: all ? [] : [...authorized] };
}

export type CaseloadClientOption = { clientId: string; name: string };

/** Clients the combobox offers: visible, active, not already on the draft. */
export function addableClients<T extends CaseloadClientOption>(
  clients: readonly T[],
  draft: CaseloadDraft,
): T[] {
  return clients.filter((c) => !(c.clientId in draft)).sort((a, b) => a.name.localeCompare(b.name));
}

export type CaseloadClientFlags = { clientId: string; hasAbi: boolean; behaviorSupport: boolean };

/** Evidence questionnaire facts for a caseload (saved or draft). */
export function caseloadFactsFor(
  draft: CaseloadDraft,
  flags: readonly CaseloadClientFlags[],
): CaseloadFacts {
  const byId = new Map(flags.map((f) => [f.clientId, f]));
  const clientIds = Object.keys(draft).filter((id) => (draft[id] ?? []).length > 0);
  const codes = new Set<string>();
  for (const id of clientIds) for (const c of draft[id] ?? []) codes.add(c);
  return {
    clientIds,
    serviceCodes: [...codes].sort(),
    hasAbiClient: clientIds.some((id) => byId.get(id)?.hasAbi === true),
    hasBehaviorSupportClient: clientIds.some((id) => byId.get(id)?.behaviorSupport === true),
  };
}

/**
 * Evidence rows the NEW caseload would suggest (ABI, behavior, service-code
 * packs) that the old caseload didn't, and the person doesn't already have
 * (on file, due, or skipped). Empty → no "New evidence suggestions" prompt.
 */
export function newEvidenceSuggestionKeys(args: {
  person: EvidencePersonFacts;
  before: CaseloadFacts;
  after: CaseloadFacts;
  existingKeys: readonly string[];
}): string[] {
  const { person } = args;
  const keysFor = (facts: CaseloadFacts) =>
    new Set(suggestedRequirementKeys(answersForPeople([person], { [person.userId]: facts })));
  const before = keysFor(args.before);
  const have = new Set(args.existingKeys);
  return [...keysFor(args.after)].filter((k) => !before.has(k) && !have.has(k)).sort();
}

/** React Query key for getMemberCaseload — shared by the tab and the header badge. */
export const teamMemberCaseloadQueryKey = (orgId: string | null | undefined, staffId: string) =>
  ["team-member-caseload", orgId ?? null, staffId] as const;
