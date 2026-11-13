// The staffing ratio on one authorization (client_billing_codes.ratio), e.g.
// "1:2" = one staff for two clients. This is the one ratio the scheduler reads
// (rule-context.server.ts parseRatio); Clients › Services & billing edits it on
// each authorization card. Pure.

/** The ratios offered on the authorization card, in order. */
export const RATIO_CHOICES = ["1:1", "1:2", "1:3", "1:4", "2:1"] as const;
export type RatioChoice = (typeof RATIO_CHOICES)[number];

/** The stored value as one of the choices, or null when it's empty or anything else. */
export function ratioChoice(raw: string | null | undefined): RatioChoice | null {
  const v = (raw ?? "").replace(/\s+/g, "");
  return (RATIO_CHOICES as readonly string[]).includes(v) ? (v as RatioChoice) : null;
}

/** What the card shows: the choice, the stored text when it's something else, or "Not set". */
export function ratioText(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  return ratioChoice(raw) ?? (trimmed || "Not set");
}
