// Word-level diff for a Nectar suggestion card: the rewrite with added or
// changed words marked, and the words taken out. Plain LCS on words; no
// library. Node --test.

export type DiffKind = "same" | "add" | "del";

export interface DiffPart {
  kind: DiffKind;
  text: string;
}

/** Words and the spaces between them, so joined parts read back as the text. */
const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

/** Largest word-count product compared exactly; bigger texts show as one replacement. */
const MAX_CELLS = 4_000_000;

/**
 * `after` against `before`, word by word. "add" parts are words in `after`
 * that are new or changed; "del" parts are words of `before` that are gone.
 * Joining "same" + "add" parts gives
 * `after`; joining "same" + "del" parts gives `before`.
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...(before ? [{ kind: "del" as const, text: before }] : []),
      ...(after ? [{ kind: "add" as const, text: after }] : []),
    ];
  }
  const w = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * w + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const raw: DiffPart[] = [];
  const push = (kind: DiffKind, text: string) => {
    const last = raw[raw.length - 1];
    if (last && last.kind === kind) last.text += text;
    else raw.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", b[j]);
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return raw;
}
