// Activity tab on the team member profile. Pure: the rows are loaded by
// getMemberActivity (activity.functions.ts) and merged here.

export const ACTIVITY_FILTERS = ["all", "shift", "form", "incident", "account"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];
export type ActivityKind = Exclude<ActivityFilter, "all">;

export const ACTIVITY_FILTER_LABEL: Record<ActivityFilter, string> = {
  all: "All",
  shift: "Shifts",
  form: "Forms",
  incident: "Incidents",
  account: "Account",
};

/** access_change_log change types that are this person's account history. */
export const ACCOUNT_CHANGE_TYPES = [
  "member_created",
  "invite_sent",
  "member_access",
  "password_reset",
  "deactivated",
  "reactivated",
] as const;
export type AccountChangeType = (typeof ACCOUNT_CHANGE_TYPES)[number];

export const ACCOUNT_CHANGE_LABEL: Record<AccountChangeType, string> = {
  member_created: "Added to the agency",
  invite_sent: "Invite sent",
  member_access: "Access changed",
  password_reset: "Password reset",
  deactivated: "Deactivated",
  reactivated: "Reactivated",
};

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  status: string | null;
  /** ISO timestamp used for ordering. */
  at: string;
  clientId?: string | null;
  clientName?: string | null;
};

export type ShiftSource = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  service_type_code: string | null;
  status: string | null;
  clock_in_timestamp: string | null;
  clock_out_timestamp: string | null;
  billed_units: number | null;
};
export type FormSource = {
  id: string;
  form_name: string | null;
  status: string | null;
  submitted_at: string | null;
  created_at: string | null;
};
export type IncidentSource = {
  id: string;
  report_number: string | null;
  status: string | null;
  incident_date: string | null;
  filed_at: string | null;
  incident_types: string[] | null;
};
export type AccountSource = {
  id: string;
  change_type: string;
  changed_by_name: string | null;
  created_at: string;
};

export type MemberActivityData = {
  shifts: ShiftSource[];
  forms: FormSource[];
  incidents: IncidentSource[];
  account: AccountSource[];
};

export const memberActivityQueryKey = (orgId: string | null | undefined, staffId: string) =>
  ["member-activity", orgId ?? null, staffId] as const;

export function isAccountChangeType(v: string): v is AccountChangeType {
  return (ACCOUNT_CHANGE_TYPES as readonly string[]).includes(v);
}

/** One row per timesheet, plus forms, incidents and account events; newest first. */
export function buildActivityItems(d: MemberActivityData): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const r of d.shifts) {
    const at = r.clock_in_timestamp;
    if (!at) continue;
    const units = r.billed_units != null ? `${r.billed_units} u` : null;
    out.push({
      id: `shift-${r.id}`,
      kind: "shift",
      title: r.service_type_code ?? "Shift",
      detail: [r.client_name, units].filter(Boolean).join(" · ") || null,
      status: r.status ?? (r.clock_out_timestamp ? "clocked out" : "clocked in"),
      at,
      clientId: r.client_id,
      clientName: r.client_name,
    });
  }
  for (const r of d.forms) {
    const at = r.submitted_at ?? r.created_at;
    if (!at) continue;
    out.push({
      id: `form-${r.id}`,
      kind: "form",
      title: r.form_name?.trim() || "Form",
      detail: null,
      status: r.status ?? "submitted",
      at,
    });
  }
  for (const r of d.incidents) {
    const at = r.filed_at ?? r.incident_date;
    if (!at) continue;
    const types = (r.incident_types ?? []).join(", ");
    out.push({
      id: `incident-${r.id}`,
      kind: "incident",
      title: r.report_number?.trim() || "Incident",
      detail: types || null,
      status: r.status ?? "filed",
      at,
    });
  }
  for (const r of d.account) {
    if (!isAccountChangeType(r.change_type)) continue;
    out.push({
      id: `account-${r.id}`,
      kind: "account",
      title: ACCOUNT_CHANGE_LABEL[r.change_type],
      detail:
        r.changed_by_name && r.changed_by_name !== "Unknown" ? `by ${r.changed_by_name}` : null,
      status: null,
      at: r.created_at,
    });
  }
  return out.sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : b.at.localeCompare(a.at)));
}

export function filterActivity(
  items: readonly ActivityItem[],
  filter: ActivityFilter,
): ActivityItem[] {
  return filter === "all" ? [...items] : items.filter((i) => i.kind === filter);
}
