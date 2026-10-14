// What askNectar returns and the pieces an answer is built from (N5,
// Decisions 7, 8 and 10). No runtime imports, so node --test and the screens
// can import it; the Supabase types below are erased at runtime.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** The request's data client: RLS applies with a user's token; the engine also filters by the caller. */
export type NectarDb = SupabaseClient<Database>;

/** Every answer and draft is labeled as AI (Decision 10). */
export const NECTAR_AI_LABEL = "Nectar · AI assistant";

/** No answer without a source (Decision 8). */
export const NOT_FOUND_ANSWER = "I couldn't find that in your agency's documents.";

/** Staff Nectar never answers pay or hours questions (Decision 7); no model call is made. */
export const PAY_HOURS_REFUSAL =
  "Nectar doesn't answer pay or hours questions. Ask your supervisor or the office.";

/** What both Ask screens show when the agency turned Nectar or Ask off (N6). */
export const ASK_OFF_ANSWER = "Ask is turned off for your agency.";

export const ADMIN_VIEW_ONLY =
  "Only an owner or an agency-wide admin can ask Nectar about the whole agency.";

/** admin = /dashboard/help (agency-wide admins only); staff = the caller's own scope. */
export const ASK_VIEWS = ["admin", "staff"] as const;
export type AskView = (typeof ASK_VIEWS)[number];

/** Who is asking, resolved on the server from their membership (never from the request). */
export interface NectarAskCaller {
  userId: string;
  orgId: string;
  view: AskView;
  /** Owner, or an admin whose scope is the whole agency. */
  agencyAdmin: boolean;
}

/**
 * Where a source came from. N6 builds its links from these:
 * library → the document (documentId), state_rule → the state rule (stateRuleId),
 * client_plan / medications → the client (clientId), schedule → the caller's
 * own shifts, agency → the Required policies tab.
 */
export type NectarSourceKind =
  "library" | "state_rule" | "client_plan" | "medications" | "schedule" | "agency";

export interface NectarSource {
  /** A knowledge_sections id, or a fact id such as "goals:<client id>" or "agency:required". */
  id: string;
  kind: NectarSourceKind;
  documentTitle: string;
  heading: string | null;
  version: number | null;
  documentId: string | null;
  stateRuleId: string | null;
  clientId: string | null;
}

/** A small labeled fact from the caller's scope (client plan, medications, shifts, agency). */
export interface NectarFact {
  id: string;
  kind: Exclude<NectarSourceKind, "library" | "state_rule">;
  title: string;
  heading: string | null;
  text: string;
  clientId: string | null;
}

/** A section or fact Nectar may answer from: the source it cites and the text it reads. */
export interface SourceCandidate {
  source: NectarSource;
  text: string;
  /** Set for knowledge_sections rows (logged as cited_section_ids). */
  sectionId: string | null;
}

export type AskRefusal = "off" | "pay_hours";

export interface AskNectarResult {
  answer: string;
  /** The sources the answer cites, in the order of its [1], [2] markers. */
  sources: NectarSource[];
  found: boolean;
  /** The logged nectar_questions row, for feedbackNectar; null when nothing was logged. */
  questionId: string | null;
  /** "off": Nectar or Ask is off for the agency (nothing asked or logged). "pay_hours": the fixed refusal. */
  refusal: AskRefusal | null;
  label: typeof NECTAR_AI_LABEL;
}

export function askResult(
  answer: string,
  opts: Partial<Omit<AskNectarResult, "answer" | "label">> = {},
): AskNectarResult {
  return {
    answer,
    sources: opts.sources ?? [],
    found: opts.found ?? false,
    questionId: opts.questionId ?? null,
    refusal: opts.refusal ?? null,
    label: NECTAR_AI_LABEL,
  };
}

/** Nectar or Ask is off: both Ask screens show the same line, and nothing is logged. */
export function askOffResult(): AskNectarResult {
  return askResult(ASK_OFF_ANSWER, { refusal: "off" });
}

export type FeedbackValue = "up" | "down";

export interface FeedbackResult {
  questionId: string;
  feedback: FeedbackValue | null;
  status: "open" | "resolved" | null;
  /** True when Nectar or Ask is off and nothing was saved. */
  off: boolean;
}
