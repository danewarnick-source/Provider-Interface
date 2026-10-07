// "Is this PCSP provider our agency?" The PCSP prints the provider's name the
// way USTEPS has it ("Example Supports, L.L.C."); the agency's Settings may
// say "Example Supports LLC" or "example supports". Names are compared on
// letters and digits only, ignoring case, punctuation, "&"/"and", a leading
// "The" and business endings (LLC, Inc, Corp, Co, Ltd, PLLC…).

const ENDINGS = new Set([
  "LLC", "LC", "PLLC", "LLP", "LP", "INC", "INCORPORATED", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED",
]);

/** "Example Supports, L.L.C." → ["EXAMPLE", "SUPPORTS"]. */
export function agencyWords(name: string | null | undefined): string[] {
  const words = String(name ?? "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    // Dotted and apostrophe'd words stay one word: "L.L.C." → "LLC", "Pat's" → "PATS".
    .replace(/[.'’]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && ENDINGS.has(words[words.length - 1])) words.pop();
  if (words.length > 1 && words[0] === "THE") words.shift();
  return words;
}

/** "Example Supports, L.L.C." → "EXAMPLESUPPORTS". Empty when nothing is left. */
export function agencyKey(name: string | null | undefined): string {
  return agencyWords(name).join("");
}

/** True when `part` appears as whole words, in order, inside `whole`. */
function hasWords(whole: string[], part: string[]): boolean {
  if (!part.length || part.length > whole.length) return false;
  for (let i = 0; i + part.length <= whole.length; i++) {
    if (part.every((w, j) => whole[i + j] === w)) return true;
  }
  return false;
}

/** Run-together names ("TrueNorth" / "True North") match inside each other only when this long. */
const MIN_RUN_TOGETHER = 8;

/**
 * Matcher for any of the agency's names (legal name and the name it goes by).
 * A provider matches when its words equal the agency's, one name's words
 * appear whole inside the other's ("Example Supports" in "Example Supports of
 * Utah"; the shorter one needs two words when it is the provider), or, spaces ignored, a long enough name contains the other.
 */
export function ourAgencyMatcher(names: string | readonly string[]): (provider: string) => boolean {
  const agencies = (typeof names === "string" ? [names] : names).map(agencyWords).filter((w) => w.length);
  return (provider: string) => {
    const p = agencyWords(provider);
    if (!p.length) return false;
    const pk = p.join("");
    return agencies.some((a) => {
      const ak = a.join("");
      // A provider shorter than our name still needs two words ("Supports" alone isn't us).
      if (ak === pk || hasWords(p, a) || (p.length > 1 && hasWords(a, p))) return true;
      if (ak.length <= pk.length) return ak.length >= MIN_RUN_TOGETHER && pk.includes(ak);
      return p.length > 1 && pk.length >= MIN_RUN_TOGETHER && ak.includes(pk);
    });
  };
}
