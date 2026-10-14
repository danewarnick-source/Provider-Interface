// Search over the knowledge sections the caller may read (N5, Decisions 7
// and 8). No runtime aliases, so node --test can import it.
//
// One call to nectar_search_sections (migration 20261014011843) returns the
// best full-text matches and the nearest embeddings among only the ids the
// caller's scope allows. Some sections have no embedding yet, so both lists
// are merged (reciprocal rank fusion) and the top 8 kept. Every row is checked
// against the scope again here, so a wrong row can never reach the model.

import type { NectarDb } from "./ask-types.ts";

/** Sections sent to the model per question. */
export const TOP_SECTIONS = 8;
/** Rows each list (full text, embeddings) returns before merging. */
export const SEARCH_POOL = 20;
/** Nearest embeddings below this cosine similarity are not a match. */
export const MIN_VECTOR_SIMILARITY = 0.25;
const RRF_K = 60;

export interface SearchScope {
  orgId: string;
  /** Published library documents meant for the caller (context/library.ts). */
  documentIds: readonly string[];
  /** Current state rules (context/state.ts). */
  stateRuleIds: readonly string[];
  /** Clients in the caller's scope (context/clients.ts), for client document sections (N7). */
  clientIds: readonly string[];
}

export interface SectionHit {
  id: string;
  organization_id: string | null;
  document_id: string | null;
  state_document_id: string | null;
  client_id: string | null;
  version: number;
  heading: string | null;
  body: string;
  text_rank: number | null;
  vector_similarity: number | null;
}

export function scopeIsEmpty(scope: SearchScope): boolean {
  return !scope.documentIds.length && !scope.stateRuleIds.length && !scope.clientIds.length;
}

/** The same rule the search function applies: a row is in scope only through an allowed id. */
export function inScope(hit: SectionHit, scope: SearchScope): boolean {
  if (hit.state_document_id) return scope.stateRuleIds.includes(hit.state_document_id);
  if (hit.organization_id !== scope.orgId) return false;
  if (hit.client_id) return scope.clientIds.includes(hit.client_id);
  return !!hit.document_id && scope.documentIds.includes(hit.document_id);
}

export async function searchSections(
  db: NectarDb,
  scope: SearchScope,
  question: string,
  embedding: string | null,
): Promise<SectionHit[]> {
  if (scopeIsEmpty(scope)) return [];
  const { data, error } = await db.rpc("nectar_search_sections", {
    p_organization_id: scope.orgId,
    p_document_ids: [...scope.documentIds],
    p_state_document_ids: [...scope.stateRuleIds],
    p_client_ids: [...scope.clientIds],
    p_query: question,
    ...(embedding ? { p_embedding: embedding } : {}),
    p_limit: SEARCH_POOL,
  });
  if (error) throw new Error("Could not search your agency's documents.");
  return (data ?? []) as SectionHit[];
}

/**
 * The top sections: in scope, a text match or a close enough embedding,
 * ranked by reciprocal rank fusion of the two lists (ties: text rank, then id).
 */
export function rankHits(
  hits: readonly SectionHit[],
  scope: SearchScope,
  limit = TOP_SECTIONS,
): SectionHit[] {
  const allowed = hits.filter((h) => inScope(h, scope));
  const byText = allowed
    .filter((h) => typeof h.text_rank === "number" && h.text_rank > 0)
    .sort((a, b) => b.text_rank! - a.text_rank! || a.id.localeCompare(b.id));
  const byVector = allowed
    .filter(
      (h) =>
        typeof h.vector_similarity === "number" && h.vector_similarity >= MIN_VECTOR_SIMILARITY,
    )
    .sort((a, b) => b.vector_similarity! - a.vector_similarity! || a.id.localeCompare(b.id));
  const score = new Map<string, number>();
  const add = (list: SectionHit[]) =>
    list.forEach((h, i) => score.set(h.id, (score.get(h.id) ?? 0) + 1 / (RRF_K + i + 1)));
  add(byText);
  add(byVector);
  const seen = new Set<string>();
  return allowed
    .filter((h) => score.has(h.id) && !seen.has(h.id) && seen.add(h.id))
    .sort(
      (a, b) =>
        score.get(b.id)! - score.get(a.id)! ||
        (b.text_rank ?? 0) - (a.text_rank ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
