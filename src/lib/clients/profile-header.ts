// Client profile header ("soft panel"): the pure pieces behind the subtitle
// line, the readiness pill and the three info tiles. No React, no Supabase.

import type { AttentionItem } from "./readiness.ts";

export type HeaderReadiness = { ready: boolean; missing: string[] };

/** "Goes by Sam · Age 34 · Maple House"; parts left out when blank. */
export function goesByLine(args: {
  preferredName: string | null | undefined;
  firstName: string | null | undefined;
  age: number | null;
  home: string | null | undefined;
}): string {
  const preferred = args.preferredName?.trim();
  const sameAsFirst =
    !!preferred && preferred.toLowerCase() === (args.firstName ?? "").trim().toLowerCase();
  return [
    preferred && !sameAsFirst ? `Goes by ${preferred}` : null,
    args.age != null ? `Age ${args.age}` : null,
    args.home?.trim() || null,
  ]
    .filter((p): p is string => !!p)
    .join(" · ");
}

/** The preferred-name custom field's text, if the agency tracks it. */
export function preferredNameFrom(
  fields:
    | readonly { field_key: string; value: { value_text: string | null } | null }[]
    | null
    | undefined,
): string | null {
  const f = fields?.find((x) => x.field_key === "preferred_name");
  return f?.value?.value_text?.trim() || null;
}

/**
 * Ready to schedule = no setup gaps (the "Finish setup" items in the
 * needs-attention list). null while the list is loading.
 */
export function headerReadiness(
  attention: readonly Pick<AttentionItem, "key" | "detail">[] | null,
): HeaderReadiness | null {
  if (!attention) return null;
  const missing = attention.filter((a) => a.key.startsWith("setup:")).map((a) => a.detail);
  return { ready: missing.length === 0, missing };
}

/** Guardian tile: name (relationship), "Own guardian", or not on file. */
export function guardianTile(
  isOwnGuardian: boolean | null | undefined,
  guardian: { name: string; relationship: string | null } | null,
): { value: string; missing: boolean } {
  if (isOwnGuardian === true) return { value: "Own guardian", missing: false };
  if (guardian) {
    const rel = guardian.relationship?.trim();
    return { value: rel ? `${guardian.name} (${rel})` : guardian.name, missing: false };
  }
  return { value: "Not on file", missing: true };
}

/** Plan year tile: amber with "PCSP is N days overdue" once the plan year has ended. */
export function planYearTile(
  endDate: string | null | undefined,
  overdueDays: number | null | undefined,
  format: (ymd: string) => string,
): { value: string; note: string | null; warn: boolean } {
  const value = endDate ? format(endDate) : "No plan year on file";
  const days = overdueDays ?? 0;
  if (days > 0) {
    return { value, note: `PCSP is ${days} day${days === 1 ? "" : "s"} overdue`, warn: true };
  }
  return { value, note: null, warn: !endDate };
}
