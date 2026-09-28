/**
 * Pre-fills the EXISTING Evidence questionnaire (subject 'staff') from what PI
 * already knows about the person or people being added. Pure: the dialog loads
 * the facts, this only decides the starting answers. Every answer stays
 * editable and nothing is created until the admin clicks Apply.
 */
import { defaultQuestionnaireAnswers } from "../evidence/catalog.ts";
import {
  STAFF_QUIZ_CODES,
  type QuestionnaireAnswers,
  type ServiceCodeFlag,
} from "../evidence/types.ts";

export type EvidencePosition = { key: string; label: string };

export type EvidencePersonFacts = {
  userId: string;
  /** profiles.transports_clients */
  transportsClients: boolean;
  /** profiles.staff_type_keys, labelled by staff_types */
  positions: readonly EvidencePosition[];
};

export type CaseloadFacts = {
  /** Clients on this person's caseload (staff_assignments). */
  clientIds: readonly string[];
  /** Service codes on those assignments, any case. */
  serviceCodes: readonly string[];
  /** Any caseload client with clients.has_abi. */
  hasAbiClient: boolean;
  /** Behavior-support caseload tracking was removed. The live loader passes false. */
  hasBehaviorSupportClient: boolean;
};

export type CaseloadFactsByUser =
  | ReadonlyMap<string, CaseloadFacts>
  | Readonly<Record<string, CaseloadFacts | undefined>>;

/** Positions that imply a service code's pack. Host Home Provider → HHS (the host home pack). */
const POSITION_CODES: Array<{ match: (p: EvidencePosition) => boolean; code: ServiceCodeFlag }> = [
  {
    match: (p) => p.key.trim().toLowerCase() === "hhp" || /host\s*home/i.test(p.label),
    code: "HHS",
  },
];

export function positionServiceCodes(positions: readonly EvidencePosition[]): ServiceCodeFlag[] {
  const out: ServiceCodeFlag[] = [];
  for (const rule of POSITION_CODES) {
    if (positions.some(rule.match) && STAFF_QUIZ_CODES.includes(rule.code)) out.push(rule.code);
  }
  return out;
}

function factsFor(caseloadFacts: CaseloadFactsByUser, userId: string): CaseloadFacts | undefined {
  if (caseloadFacts instanceof Map) return caseloadFacts.get(userId);
  return (caseloadFacts as Record<string, CaseloadFacts | undefined>)[userId];
}

/** Codes every person's positions imply — a pack is only pre-checked when it fits everyone. */
function sharedPositionCodes(people: readonly EvidencePersonFacts[]): ServiceCodeFlag[] {
  if (!people.length) return [];
  const [first, ...rest] = people.map((p) => positionServiceCodes(p.positions));
  return (first ?? []).filter((code) => rest.every((codes) => codes.includes(code)));
}

function inQuizOrder(codes: Iterable<ServiceCodeFlag>): ServiceCodeFlag[] {
  const set = new Set(codes);
  return STAFF_QUIZ_CODES.filter((c) => set.has(c));
}

/**
 * Starting answers for one person or a batch:
 *   serviceCodes  = union of caseload codes that are STAFF_QUIZ_CODES, plus
 *                   codes every person's Position implies (Host Home Provider → HHS)
 *   transportsPeople = profiles.transports_clients (all of them, for a batch)
 *   worksWithAbi  = any caseload client has_abi
 *   maySupportAggressiveBehavior = caseload fact hasBehaviorSupportClient (live loader passes false)
 *   includeCompanyCustoms = false
 * With no caseload yet: defaultQuestionnaireAnswers('staff'), but transport from
 * the profile and the Position codes.
 */
export function answersForPeople(
  people: readonly EvidencePersonFacts[],
  caseloadFacts: CaseloadFactsByUser,
): QuestionnaireAnswers {
  const base = defaultQuestionnaireAnswers("staff");
  const transportsPeople = people.length > 0 && people.every((p) => p.transportsClients);
  const fromPositions = sharedPositionCodes(people);
  const caseloads = people
    .map((p) => factsFor(caseloadFacts, p.userId))
    .filter((f): f is CaseloadFacts => !!f && f.clientIds.length > 0);

  if (!caseloads.length) {
    return { ...base, transportsPeople, serviceCodes: inQuizOrder(fromPositions) };
  }

  const quiz = new Set<string>(STAFF_QUIZ_CODES);
  const codes = new Set<ServiceCodeFlag>(fromPositions);
  for (const facts of caseloads) {
    for (const raw of facts.serviceCodes) {
      const code = raw.trim().toUpperCase();
      if (quiz.has(code)) codes.add(code as ServiceCodeFlag);
    }
  }
  return {
    ...base,
    serviceCodes: inQuizOrder(codes),
    transportsPeople,
    worksWithAbi: caseloads.some((f) => f.hasAbiClient),
    maySupportAggressiveBehavior: caseloads.some((f) => f.hasBehaviorSupportClient),
    includeCompanyCustoms: false,
  };
}
