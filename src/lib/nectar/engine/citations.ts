// PI checks every cited source before an answer is shown (N5, Decision 8).
// Pure: no imports, so node --test can import it.
//
// The model cites sources as [S:<id>] with the short ids it was sent (s1, s2,
// ...). Any id that was not sent is stripped. The ones that remain become
// numbered markers [1], [2] in the order they are first cited, matching the
// order of the sources askNectar returns. No valid citation left means no
// answer: the caller shows "I couldn't find that in your agency's documents."

/** [S:s1], [S: s1, s2], [S:s1; S:s2] */
const MARKER = /\[\s*S\s*:\s*([^\]\n]{1,200})\]/gi;
/** [s1], [s1, s2]: the same ids without the "S:" the model was asked for. */
const BARE = /\[\s*(s\d{1,3}(?:\s*[,;]\s*s\d{1,3})*)\s*\]/gi;
const REMOVED = "\u0000";

export interface CheckedAnswer {
  answer: string;
  /** The ids cited, in the order of first use: [1] is cited[0]. */
  cited: string[];
}

function citedIds(inner: string): string[] {
  return inner
    .split(/[,;\s]+/)
    .map((token) =>
      token
        .replace(/^S\s*:/i, "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

/** True when the reply only says it couldn't find the answer. */
export function isNotFoundReply(text: string, notFound: string): boolean {
  const plain = (s: string) =>
    s
      .replace(/[’]/g, "'")
      .replace(/[\s.]+$/g, "")
      .trim()
      .toLowerCase();
  return plain(text) === plain(notFound);
}

/**
 * Strips citations to ids that were not sent and numbers the rest. Returns
 * null when no valid citation remains, or when the reply is only the
 * "couldn't find" sentence.
 */
export function checkCitations(
  raw: string,
  sentIds: ReadonlySet<string>,
  notFound: string,
): CheckedAnswer | null {
  const order: string[] = [];
  const replace = (_match: string, inner: string) => {
    const kept = [...new Set(citedIds(inner))].filter((id) => sentIds.has(id));
    for (const id of kept) if (!order.includes(id)) order.push(id);
    return kept.length ? kept.map((id) => `[${order.indexOf(id) + 1}]`).join("") : REMOVED;
  };
  const answer = (raw ?? "")
    .replace(MARKER, replace)
    .replace(BARE, replace)
    .replace(new RegExp(`[ \\t]*${REMOVED}`, "g"), "")
    .replace(/[ \t]+$/gm, "")
    .trim();
  if (!order.length) return null;
  if (isNotFoundReply(answer.replace(/\[\d+\]/g, ""), notFound)) return null;
  return { answer, cited: order };
}
