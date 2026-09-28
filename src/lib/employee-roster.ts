/**
 * Admin Employees roster split.
 *
 * Soft-deactivate already lives on existing columns — no migration:
 *   - organization_members.active (list Deactivate / Reactivate)
 *   - profiles.is_active (hire + archiveEntity)
 *   - profiles.account_status 'active' | 'archived' (archiveEntity / LifecyclePanel)
 *
 * Active tab = operational roster. Inactive = deactivated or archived.
 * They must never mix.
 */

export type EmployeeRosterTab = "active" | "inactive";

export type EmployeeRosterProfile = {
  account_status?: string | null;
  is_active?: boolean | null;
};

export type EmployeeRosterMember = {
  active: boolean;
  profile?: EmployeeRosterProfile | null;
};

/** True only when the member belongs on the Active Employees tab. */
export function isEmployeeOnActiveRoster(member: EmployeeRosterMember): boolean {
  if (!member.active) return false;
  const profile = member.profile;
  if ((profile?.account_status ?? "active") === "archived") return false;
  if (profile?.is_active === false) return false;
  return true;
}

export function filterEmployeesByRosterTab<T extends EmployeeRosterMember>(
  members: readonly T[] | null | undefined,
  tab: EmployeeRosterTab,
): T[] {
  return (members ?? []).filter((m) =>
    tab === "active" ? isEmployeeOnActiveRoster(m) : !isEmployeeOnActiveRoster(m),
  );
}

export function countEmployeesOnRosterTab(
  members: readonly EmployeeRosterMember[] | null | undefined,
  tab: EmployeeRosterTab,
): number {
  return filterEmployeesByRosterTab(members, tab).length;
}

/** Bulk-added people stay on the roster until an admin finishes their job questions. */
export function profileNeedsSetup(customAttributes: unknown): boolean {
  if (
    !customAttributes ||
    typeof customAttributes !== "object" ||
    Array.isArray(customAttributes)
  ) {
    return false;
  }
  return (customAttributes as Record<string, unknown>).needs_setup === true;
}

export function uniqueHireEmails(emails: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) return email;
    seen.add(email);
  }
  return null;
}

const ROSTER_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Same date style as the roster Start date column.
 * A bare "YYYY-MM-DD" (hire_date / start_date columns) is a calendar day, not an
 * instant: parse it as a LOCAL date. `new Date("2025-01-15")` is midnight UTC,
 * which in America/Denver is still Jan 14 — the roster would show a day earlier
 * than the profile. Full timestamps keep their instant.
 */
export function formatRosterDate(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnly = DATE_ONLY_RE.exec(value.trim());
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", ROSTER_DATE_FORMAT);
}

/**
 * Last Login cell.
 * Unknown / RPC missing / staff not in the result → em dash.
 * Auth last_sign_in_at is null (known never) → Never.
 */
export function formatLastLogin(lastSignInAt: string | null | undefined, known: boolean): string {
  if (!known) return "—";
  if (!lastSignInAt) return "Never";
  return formatRosterDate(lastSignInAt);
}

export function lastLoginByUserId(rows: unknown): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { user_id?: unknown; last_sign_in_at?: unknown };
    if (typeof rec.user_id !== "string" || rec.user_id.length === 0) continue;
    const at = rec.last_sign_in_at;
    out.set(rec.user_id, typeof at === "string" && at.length > 0 ? at : null);
  }
  return out;
}
