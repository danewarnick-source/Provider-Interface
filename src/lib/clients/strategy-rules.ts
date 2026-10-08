// Contract rules for support strategies (DHHS91172 SOW §1.24(5)) and the
// bullet format they are written in. One source of truth for which codes need
// a strategy: every service needs at least one, except the exempt codes; the
// BSP is the strategy for Behavior Consultation and the Medical Care Plan is
// the strategy for Professional Nursing. Pure (no Supabase), node --test.

/** Services that need no support strategy (§1.24(5)): ELS, MTP, PBA, PM1/PM2 and Respite. */
export const STRATEGY_EXEMPT_CODES: ReadonlySet<string> = new Set([
  "ELS",
  "MTP",
  "PBA",
  "PM1",
  "PM2",
  "RP2",
  "RP3",
  "RP4",
  "RP5",
  "RL6",
  "RPS",
]);

/** Services whose strategy is another plan (§1.24(5)), not one Nectar drafts. */
export const STRATEGY_OTHER_PLAN: Readonly<Record<string, "BSP" | "Medical Care Plan">> = {
  BC1: "BSP",
  BC2: "BSP",
  BC3: "BSP",
  PN1: "Medical Care Plan",
  PN2: "Medical Care Plan",
};

/** Supported employment: strategies build on-the-job independence and fade paid support (§28.2(6), §30.2(7)). */
export const EMPLOYMENT_CODES: ReadonlySet<string> = new Set(["SEI", "SED", "SEC", "SEE"]);
/** Supported job development: strategies from the person's needs, strengths, abilities, interests (§33.2(g)). */
export const JOB_DEVELOPMENT_CODES: ReadonlySet<string> = new Set(["SJD"]);
/** Employment strategies the office also enters in UPI within 2 weeks of a PCSP update (§30.3(6), §33.3(5)). */
export const UPI_STRATEGY_CODES: ReadonlySet<string> = new Set(["SEI", "SJD"]);

export type StrategyNeed =
  | { kind: "needed" }
  | { kind: "exempt" }
  | { kind: "other_plan"; plan: "BSP" | "Medical Care Plan" };

const up = (c: string) => c.trim().toUpperCase();

/** Whether one code needs a strategy written for it. */
export function codeNeedsStrategy(code: string): boolean {
  const c = up(code);
  return !!c && !STRATEGY_EXEMPT_CODES.has(c) && !STRATEGY_OTHER_PLAN[c];
}

/** A support needs a strategy when any of its codes does; otherwise why not. */
export function strategyNeed(codes: readonly string[]): StrategyNeed {
  const cs = codes.map(up).filter(Boolean);
  if (!cs.length || cs.some(codeNeedsStrategy)) return { kind: "needed" };
  const other = cs.map((c) => STRATEGY_OTHER_PLAN[c]).find(Boolean);
  return other ? { kind: "other_plan", plan: other } : { kind: "exempt" };
}

/** What a support with no strategy of its own shows instead. */
export function strategyNeedText(need: StrategyNeed): string {
  if (need.kind === "other_plan") return `Covered by the ${need.plan}`;
  if (need.kind === "exempt") return "Not needed (§1.24(5))";
  return "";
}

// ── Bullets ────────────────────────────────────────────────────────────────
// A strategy is stored as "- " lines in its one text field.

export const MIN_BULLETS = 4;
export const MAX_BULLETS = 6;
export const MAX_BULLET_WORDS = 30;

const MARKER = /^\s*(?:[-*•‣–]|\d{1,2}[.)])\s+/;

/** The strategy's bullets: one per non-empty line, list markers removed. */
export function parseBullets(text: string | null | undefined): string[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(MARKER, "").trim())
    .filter(Boolean);
}

/** Bullets as the stored text ("- " lines). */
export function formatBullets(bullets: readonly string[]): string {
  return bullets
    .map((b) => b.replace(MARKER, "").trim())
    .filter(Boolean)
    .map((b) => `- ${b}`)
    .join("\n");
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Why a drafted set of bullets is not usable, or null when it is. */
export function bulletProblem(bullets: readonly unknown[]): string | null {
  if (bullets.length < MIN_BULLETS || bullets.length > MAX_BULLETS) {
    return `needs ${MIN_BULLETS}–${MAX_BULLETS} bullet points (got ${bullets.length})`;
  }
  for (const b of bullets) {
    if (typeof b !== "string" || !b.trim()) return "has an empty bullet point";
    if (wordCount(b) > MAX_BULLET_WORDS) {
      return `has a bullet point over ${MAX_BULLET_WORDS} words`;
    }
  }
  return null;
}
