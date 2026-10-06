/**
 * Old Team Members addresses (the retired employees routes) live on in saved
 * notifications and emails. The permanent redirect routes use these helpers
 * to carry the old search params onto /dashboard/team-members.
 */
export type LegacyRosterSearch = { import?: 1 };
export type LegacyProfileSearch = { tab?: "file" | "profile" | "activity" };

/** ?upload=1 / ?upload=true (every spelling the old roster accepted) -> ?import=1 */
export function legacyRosterSearch(search: unknown): LegacyRosterSearch {
  const upload = (search as { upload?: unknown } | null | undefined)?.upload;
  const wantsImport = upload === true || upload === 1 || upload === "1" || upload === "true";
  return wantsImport ? { import: 1 } : {};
}

const LEGACY_PROFILE_TAB = new Map<string, NonNullable<LegacyProfileSearch["tab"]>>([
  ["record", "file"],
  ["obligations", "file"],
  ["staff", "file"],
  ["personnel", "file"],
  ["permissions", "profile"],
  ["profile", "profile"],
  ["activity", "activity"],
]);

/** record | obligations | staff | personnel -> file; permissions -> profile; activity -> activity. */
export function legacyProfileSearch(search: unknown): LegacyProfileSearch {
  const tab = (search as { tab?: unknown } | null | undefined)?.tab;
  const next = typeof tab === "string" ? LEGACY_PROFILE_TAB.get(tab) : undefined;
  return next ? { tab: next } : {};
}
