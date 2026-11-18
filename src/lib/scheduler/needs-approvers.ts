// Who may approve a swap or a time-off request (B2 Settings › Approvals, per
// home). Pure. The owner can always approve anything. Otherwise each home the
// request touches says "Lead" or "Owner only" (team_schedule_settings
// swap_approval / timeoff_approval, else APPROVAL_DEFAULTS), and the viewer
// must be the lead of every one of those homes. A request tied to no home is
// the owner's. Claims are not here: decideClaim keeps Owner or agency-wide
// Admin. Called by needs-list.ts (to disable buttons with the reason) and
// requests.functions.ts (to refuse on the server).
import { APPROVAL_DEFAULTS, type Approver } from "./settings/settings-model.ts";
import { homeKind } from "../homes/home-kind.ts";

export type ApprovalKind = "swap" | "timeoff";

export type ApprovalHome = {
  id: string;
  name: string;
  /** The home's lead; null on a host home (the host never schedules) or with no lead. */
  leadId: string | null;
  swap: Approver | null;
  timeoff: Approver | null;
};

export type Approval = { ok: true } | { ok: false; reason: string };

const LABEL: Record<ApprovalKind, string> = { swap: "swaps", timeoff: "time off" };

/** A home as the approval check reads it, from teams + team_schedule_settings. */
export function approvalHome(
  team: { id: string; team_name: string; team_type: string | null; manager_id: string | null },
  settings: { swap_approval?: string | null; timeoff_approval?: string | null } | null,
): ApprovalHome {
  const pick = (v: string | null | undefined): Approver | null =>
    v === "lead" || v === "owner" ? v : null;
  return {
    id: team.id,
    name: team.team_name,
    leadId: homeKind(team.team_type) === "host_home" ? null : team.manager_id,
    swap: pick(settings?.swap_approval),
    timeoff: pick(settings?.timeoff_approval),
  };
}

export function approverOf(kind: ApprovalKind, home: ApprovalHome): Approver {
  return home[kind] ?? APPROVAL_DEFAULTS[kind];
}

export function canApprove(
  kind: ApprovalKind,
  viewer: { userId: string; isOwner: boolean },
  homes: readonly ApprovalHome[],
): Approval {
  if (viewer.isOwner) return { ok: true };
  const what = LABEL[kind];
  if (!homes.length)
    return { ok: false, reason: `Only the owner approves ${what} that aren't tied to a home.` };
  for (const h of homes) {
    if (approverOf(kind, h) === "owner")
      return { ok: false, reason: `At ${h.name}, only the owner approves ${what}.` };
    if (h.leadId !== viewer.userId)
      return { ok: false, reason: `Only ${h.name}'s lead or the owner approves ${what}.` };
  }
  return { ok: true };
}

/** The distinct homes a set of shifts belongs to: the shift's home, else its client's. */
export function homesOfShifts(
  shifts: ReadonlyArray<{ team_id: string | null; client_id: string | null }>,
  clientHome: ReadonlyMap<string, string | null>,
  homes: ReadonlyMap<string, ApprovalHome>,
): ApprovalHome[] {
  const ids = new Set<string>();
  for (const s of shifts) {
    const id = s.team_id ?? (s.client_id ? (clientHome.get(s.client_id) ?? null) : null);
    if (id) ids.add(id);
  }
  return [...ids].map((id) => homes.get(id)).filter((h): h is ApprovalHome => !!h);
}
