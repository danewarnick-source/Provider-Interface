export type AccessLevel = "owner" | "admin" | "staff";
export type AccessScope = "agency" | "assigned" | "self";
export type AssignmentKind = "home" | "staff" | "client";

export const ACCESS_LEVELS: AccessLevel[] = ["owner", "admin", "staff"];
export const ACCESS_SCOPES: AccessScope[] = ["agency", "assigned", "self"];

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export const LEVEL_SUMMARY: Record<AccessLevel, string> = {
  owner: "Everything, including agency settings and who can do what. Can't be limited.",
  admin: "Works in the web dashboard. Each area is set to Off, View or Edit by their preset.",
  staff: "Uses the phone app for their own work. Presets can add read-only views.",
};

export const SCOPE_LABEL: Record<AccessScope, string> = {
  agency: "Whole agency",
  assigned: "Assigned homes, staff & clients",
  self: "Only themselves",
};

export const LEVEL_HOME: Record<AccessLevel, string> = {
  owner: "/dashboard",
  admin: "/dashboard",
  staff: "/employee",
};

const RANK: Record<string, number> = { staff: 1, admin: 2, owner: 3 };

/** Accepts raw DB strings; anything that isn't a known level fails closed. */
export function isLevelAtLeast(level: string | null | undefined, min: AccessLevel): boolean {
  return !!level && (RANK[level] ?? 0) >= RANK[min]!;
}

export const isOwner = (level: string | null | undefined): boolean => level === "owner";

/** Owner or Admin — anyone who works in the web dashboard. */
export const isAdminLevel = (level: string | null | undefined): boolean =>
  isLevelAtLeast(level, "admin");

/** Owner, or an Admin whose scope is the whole agency (matches is_org_admin_or_manager in SQL). */
export function isAgencyAdmin(
  level: AccessLevel | null | undefined,
  scope: AccessScope | string | null | undefined,
): boolean {
  return level === "owner" || (level === "admin" && scope === "agency");
}

export function levelHome(level: AccessLevel | null | undefined, presetHome?: string | null): string {
  return presetHome || LEVEL_HOME[level ?? "staff"];
}
