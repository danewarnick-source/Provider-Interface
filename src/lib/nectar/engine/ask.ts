// What askNectar does after its guards (N5, Decisions 7 and 8). No runtime
// aliases, so node --test runs it with a fake database and a mocked Bedrock.
//
// 1. A pay or hours question in the staff view gets the fixed refusal, with
//    no model call.
// 2. Scope comes from the caller's access: library documents meant for them,
//    the state rules, the clients in their scope, their own shifts and, in
//    the admin view, agency facts.
// 3. Search the sections in that scope (full text and embeddings), top 8.
// 4. Nothing to answer from: the fixed "couldn't find" answer, no model call.
// 5. The model answers from the sources sent; citations are checked, and only
//    the cited sources are returned.
// 6. Every question is logged; not found → open in the Questions tab.

import { denverYmd } from "../../denver-date.ts";
import { loadAgencyFacts } from "../context/agency.ts";
import { loadClientFacts } from "../context/clients.ts";
import { loadLibraryDocs, type LibraryDoc } from "../context/library.ts";
import { loadShiftFacts } from "../context/shifts.ts";
import { loadStateRules, type StateRuleDoc } from "../context/state.ts";
import {
  ADMIN_VIEW_ONLY,
  askResult,
  NOT_FOUND_ANSWER,
  PAY_HOURS_REFUSAL,
  type AskNectarResult,
  type NectarAskCaller,
  type NectarDb,
  type NectarFact,
  type SourceCandidate,
} from "./ask-types.ts";
import { checkCitations } from "./citations.ts";
import { questionWantsPayOrHours } from "./intent.ts";
import { buildSystemPrompt, buildUserMessage, labelSources } from "./prompt.ts";
import { loadAskerAndAgency, logQuestion, type QuestionLog } from "./questions.ts";
import { rankHits, searchSections, type SearchScope, type SectionHit } from "./search.ts";

export interface AskDeps {
  db: NectarDb;
  /** The question's embedding as a pgvector literal, or null (search then uses full text only). */
  embed: (text: string) => Promise<string | null>;
  /** One model call: system prompt and user turn in, reply text out. */
  model: (system: string, user: string) => Promise<string>;
  now?: Date;
}

/** A search hit as a source, titled from the document or state rule it belongs to. */
export function sectionCandidate(
  hit: SectionHit,
  docs: ReadonlyMap<string, LibraryDoc>,
  rules: ReadonlyMap<string, StateRuleDoc>,
): SourceCandidate | null {
  const base = { sectionId: hit.id, text: hit.body };
  if (hit.state_document_id) {
    const rule = rules.get(hit.state_document_id);
    if (!rule) return null;
    return {
      ...base,
      source: {
        id: hit.id,
        kind: "state_rule",
        documentTitle: rule.title,
        heading: hit.heading,
        version: hit.version ?? rule.version,
        documentId: null,
        stateRuleId: rule.id,
        clientId: null,
      },
    };
  }
  // Client document sections (N7) have no library document here and are skipped.
  const doc = hit.document_id && !hit.client_id ? docs.get(hit.document_id) : undefined;
  if (!doc) return null;
  return {
    ...base,
    source: {
      id: hit.id,
      kind: "library",
      documentTitle: doc.title,
      heading: hit.heading,
      version: hit.version ?? doc.version,
      documentId: doc.id,
      stateRuleId: null,
      clientId: null,
    },
  };
}

export function factCandidate(fact: NectarFact): SourceCandidate {
  return {
    sectionId: null,
    text: fact.text,
    source: {
      id: fact.id,
      kind: fact.kind,
      documentTitle: fact.title,
      heading: fact.heading,
      version: null,
      documentId: null,
      stateRuleId: null,
      clientId: fact.clientId,
    },
  };
}

export async function runAskNectar(
  caller: NectarAskCaller,
  question: string,
  deps: AskDeps,
): Promise<AskNectarResult> {
  if (caller.view === "admin" && !caller.agencyAdmin) throw new Error(ADMIN_VIEW_ONLY);
  const q = question.trim();
  const { db } = deps;
  const now = deps.now ?? new Date();
  const asker = loadAskerAndAgency(db, caller).catch(() => ({
    askerName: null,
    orgName: "your agency",
  }));
  const log = async (entry: Omit<QuestionLog, "question" | "askerName">) =>
    logQuestion(db, caller, { ...entry, question: q, askerName: (await asker).askerName });
  const notFound = async () =>
    askResult(NOT_FOUND_ANSWER, {
      questionId: await log({
        answer: NOT_FOUND_ANSWER,
        found: false,
        citedSectionIds: [],
        clientIds: [],
      }),
    });

  if (caller.view === "staff" && questionWantsPayOrHours(q)) {
    const questionId = await log({
      answer: PAY_HOURS_REFUSAL,
      found: false,
      citedSectionIds: [],
      clientIds: [],
    });
    return askResult(PAY_HOURS_REFUSAL, { questionId, refusal: "pay_hours" });
  }

  const [docs, rules, clients, shifts, agency, embedding] = await Promise.all([
    loadLibraryDocs(db, caller),
    loadStateRules(db),
    loadClientFacts(db, caller, q),
    loadShiftFacts(db, caller, q, now),
    loadAgencyFacts(db, caller, denverYmd(now)),
    deps.embed(q).catch(() => null),
  ]);
  const scope: SearchScope = {
    orgId: caller.orgId,
    documentIds: docs.map((d) => d.id),
    stateRuleIds: rules.map((r) => r.id),
    clientIds: clients.scope.map((c) => c.id),
  };
  const hits = rankHits(await searchSections(db, scope, q, embedding), scope);
  const docById = new Map(docs.map((d) => [d.id, d]));
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const candidates = [
    ...hits
      .map((h) => sectionCandidate(h, docById, ruleById))
      .filter((c): c is SourceCandidate => c !== null),
    ...[...clients.facts, ...shifts, ...agency].map(factCandidate),
  ];
  if (!candidates.length) return notFound();

  const sources = labelSources(candidates);
  const system = buildSystemPrompt({
    orgId: caller.orgId,
    orgName: (await asker).orgName,
    view: caller.view,
    sources,
    notFound: NOT_FOUND_ANSWER,
  });
  const reply = await deps.model(system, buildUserMessage(q));
  const checked = checkCitations(reply, new Set(sources.map((s) => s.label)), NOT_FOUND_ANSWER);
  if (!checked) return notFound();

  const cited = checked.cited
    .map((label) => sources.find((s) => s.label === label))
    .filter((s): s is (typeof sources)[number] => !!s);
  const questionId = await log({
    answer: checked.answer,
    found: true,
    citedSectionIds: cited.flatMap((c) => (c.sectionId ? [c.sectionId] : [])),
    clientIds: cited.flatMap((c) => (c.source.clientId ? [c.source.clientId] : [])),
  });
  return askResult(checked.answer, {
    sources: cited.map((c) => c.source),
    found: true,
    questionId,
  });
}
