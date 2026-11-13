// Who gets an open shift at a home (Decision 6, Settings › Open shifts): the
// home's own pickup setting, else the agency's. "auto" = first to claim gets
// it; "lead" / "owner" = the claim waits for that approver (Needs you, B5).
// Called by claimOpenShift and the Settings screen. Pure.
export type PickupMode = "auto" | "lead" | "owner";
export type ClaimMode = "first" | "approve";

export function pickupModeFor(
  agency: ClaimMode | string,
  home: PickupMode | string | null | undefined,
): PickupMode {
  if (home === "auto" || home === "lead" || home === "owner") return home;
  return agency === "approve" ? "lead" : "auto";
}

export const PICKUP_LABEL: Record<PickupMode, string> = {
  auto: "First to claim",
  lead: "Lead approves",
  owner: "Owner approves",
};
