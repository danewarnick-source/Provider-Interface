// What the indexer writes to knowledge_sections (N3). Pure: no Supabase, no
// aliases, so node --test can import it. index.server.ts does the writes.

import type { TextSection } from "./sections.ts";

export const EMBED_DIMENSIONS = 1024;
/** Titan v2 reads at most ~8,000 characters of one input. */
const EMBED_INPUT_CHARS = 8000;
/** Inputs per embeddings call, and calls in flight at once. */
export const EMBED_BATCH = 8;
export const EMBED_CONCURRENCY = 4;
/** Time the publish call spends on embeddings; the rest are embedded on the next library change. */
export const PUBLISH_EMBED_BUDGET_MS = 12_000;
/** A document past this many sections is cut off (and says so in the logs by id only). */
export const MAX_SECTIONS_PER_DOCUMENT = 3000;

export type SectionSource =
  | { kind: "library"; organizationId: string; documentId: string; version: number; title: string }
  | { kind: "state"; stateDocumentId: string; version: number; title: string };

/** What gets embedded for a section: the document title, its heading and its text. */
export function embeddingInput(
  title: string,
  section: Pick<TextSection, "heading" | "body">,
): string {
  return [title, section.heading, section.body]
    .filter(Boolean)
    .join("\n")
    .slice(0, EMBED_INPUT_CHARS);
}

/** pgvector's text form, or null for anything that isn't a full 1024-number vector. */
export function vectorLiteral(vector: unknown): string | null {
  if (!Array.isArray(vector) || vector.length !== EMBED_DIMENSIONS) return null;
  if (!vector.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return `[${vector.join(",")}]`;
}

/** The knowledge_sections rows for one version, with an embedding where one was made. */
export function sectionRows(
  source: SectionSource,
  sections: readonly TextSection[],
  vectors: ReadonlyArray<string | null> = [],
) {
  return sections.slice(0, MAX_SECTIONS_PER_DOCUMENT).map((s, i) => ({
    organization_id: source.kind === "library" ? source.organizationId : null,
    document_id: source.kind === "library" ? source.documentId : null,
    state_document_id: source.kind === "state" ? source.stateDocumentId : null,
    version: source.version,
    heading: s.heading,
    body: s.body,
    position: s.position,
    embedding: vectors[i] ?? null,
  }));
}

/** Index batches: [0..7], [8..15], ... */
export function batches(count: number, size = EMBED_BATCH): number[][] {
  const out: number[][] = [];
  for (let start = 0; start < count; start += size) {
    out.push(Array.from({ length: Math.min(size, count - start) }, (_, i) => start + i));
  }
  return out;
}

/** Embeddings serve Ask: they are made only while the agency has Nectar and Ask on. */
export function shouldEmbed(settings: { enabled: boolean; ask: boolean }): boolean {
  return settings.enabled && settings.ask;
}
