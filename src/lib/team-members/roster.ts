import { addDays, effectiveAttentionDate, parseIsoDate, resolveHireDate } from "../evidence/due.ts";
import { cellStatus, itemHasCompletedEvidence, latestFileForItem } from "../evidence/status.ts";
import type { EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";
import { csvCell } from "./file.ts";

/**
 * Admin Employees roster split.
 *
 * Soft-deactivate already lives on existing columns — no migration:
 *   - organization_members.active (list Deactivate / Reactivate)
 *   - profiles.is_active (hire + deactivateMember)
 *   - profiles.account_status 'active' | 'archived' (deactivateMember / reactivateMember)
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

/* ------------------------------------------------------------------------- */
/* Roster rows (listTeamRoster). Pure — no Supabase — so node --test runs it. */
/* ------------------------------------------------------------------------- */

export const MISSING_INFO_KEYS = [
  "hire_date",
  "date_of_birth",
  "address",
  "emergency_contact",
] as const;
export type MissingInfoKey = (typeof MISSING_INFO_KEYS)[number];

export const MISSING_INFO_LABEL: Record<MissingInfoKey, string> = {
  hire_date: "Start date",
  date_of_birth: "Date of birth",
  address: "Address",
  emergency_contact: "Emergency contact",
};

/** Hover text for the Missing info chip: "Date of birth, emergency contact". */
export function missingInfoText(keys: readonly MissingInfoKey[]): string {
  const words = MISSING_INFO_KEYS.filter((k) => keys.includes(k)).map((k, i) => {
    const w = MISSING_INFO_LABEL[k];
    return i === 0 ? w : w.toLowerCase();
  });
  return words.join(", ");
}

export type RosterPosition = { key: string; label: string };

const slug = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * profiles.staff_type_keys -> Position chips. Most rows hold staff_types keys
 * ("dsp"); the Add dialog saves labels ("Executive Director"). Both resolve to
 * the org's staff_types row by key, then by label, then by slug, so the same
 * position always gets one key. Unknown values keep their text.
 */
export function resolvePositions(
  saved: readonly string[] | null | undefined,
  staffTypes: readonly RosterPosition[],
): RosterPosition[] {
  const byKey = new Map(staffTypes.map((t) => [t.key.toLowerCase(), t]));
  const byLabel = new Map(staffTypes.map((t) => [t.label.trim().toLowerCase(), t]));
  const out = new Map<string, RosterPosition>();
  for (const raw of saved ?? []) {
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) continue;
    const lower = v.toLowerCase();
    const hit = byKey.get(lower) ?? byLabel.get(lower) ?? byKey.get(slug(v));
    const pos = hit ? { key: hit.key, label: hit.label } : { key: slug(v) || v, label: v };
    if (!out.has(pos.key)) out.set(pos.key, pos);
  }
  return [...out.values()];
}

/** Position cell: up to two labels, then "+N". */
export function positionSummary(positions: readonly RosterPosition[]): {
  shown: string[];
  more: number;
} {
  return {
    shown: positions.slice(0, 2).map((p) => p.label),
    more: Math.max(0, positions.length - 2),
  };
}

export type RosterEvidenceSummary = {
  hasPack: boolean;
  total: number;
  done: number;
  dueSoon: number;
  missing: number;
  awaitingReview: number;
  skipped: number;
};

export type RosterRow = {
  userId: string;
  memberId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeId: string;
  photoPath: string | null;
  jobTitle: string | null;
  accessLevel: "owner" | "admin" | "staff";
  /** From profiles.staff_type_keys, labelled by staff_types. */
  positions: RosterPosition[];
  homeId: string | null;
  homeName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  /** YYYY-MM-DD or null. */
  hireDate: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastSignInAt: string | null;
  /** False when the sign-in lookup failed — the cell shows "—" instead of "Never". */
  lastSignInKnown: boolean;
  /** Pending invitation for this person's email, if any (Resend vs Send invite). */
  pendingInviteId: string | null;
  evidence: RosterEvidenceSummary;
  missingInfo: MissingInfoKey[];
};

/** Days ahead that count as "due soon" on the roster. */
export const ROSTER_DUE_SOON_DAYS = 30;

export type RosterEvidenceItem = EvidenceItemRow;
export type RosterEvidenceFile = EvidenceFileRow;

/**
 * One person's Evidence summary — the same status rules the Evidence page uses
 * (cellStatus / latestFileForItem / effectiveAttentionDate), never re-derived.
 *  - done: cellStatus 'done' (accepted, on file, not past due)
 *  - missing: cellStatus 'missing' or 'sent_back'
 *  - awaitingReview: cellStatus 'awaiting_review' (latest file pending) — not missing, not done
 *  - dueSoon: attention date between today and today + 30 days
 *  - skipped: cellStatus 'skipped'; excluded from every other count
 */
export function summarizeEvidence(
  items: readonly RosterEvidenceItem[],
  files: readonly RosterEvidenceFile[],
  today: string,
): RosterEvidenceSummary {
  const out: RosterEvidenceSummary = {
    hasPack: items.length > 0,
    total: 0,
    done: 0,
    dueSoon: 0,
    missing: 0,
    awaitingReview: 0,
    skipped: 0,
  };
  const soonEnd = addDays(today, ROSTER_DUE_SOON_DAYS) ?? today;
  for (const item of items) {
    const file = latestFileForItem(files, item.id);
    const status = cellStatus({ item, file, today });
    if (status === "skipped") {
      out.skipped += 1;
      continue;
    }
    out.total += 1;
    if (status === "done") out.done += 1;
    else if (status === "awaiting_review") out.awaitingReview += 1;
    else out.missing += 1;
    const attention = parseIsoDate(
      effectiveAttentionDate({
        hasFile: itemHasCompletedEvidence(item, file),
        firstDueOn: item.first_due_on,
        nextDueOn: item.next_due_on,
        expiresOn: item.expires_on,
      }),
    );
    if (attention && attention >= today && attention <= soonEnd) out.dueSoon += 1;
  }
  return out;
}

export const EMPTY_EVIDENCE: RosterEvidenceSummary = {
  hasPack: false,
  total: 0,
  done: 0,
  dueSoon: 0,
  missing: 0,
  awaitingReview: 0,
  skipped: 0,
};

export type EvidenceLabelKind = "no_pack" | "missing" | "review" | "due_soon" | "current";

/** Roster Evidence cell. Worst first: missing, then awaiting review, then due soon. */
export function evidenceLabel(e: RosterEvidenceSummary): { kind: EvidenceLabelKind; text: string } {
  if (!e.hasPack) return { kind: "no_pack", text: "No pack yet" };
  if (e.missing > 0) return { kind: "missing", text: `${e.missing} missing` };
  if (e.awaitingReview > 0) return { kind: "review", text: `${e.awaitingReview} awaiting review` };
  if (e.dueSoon > 0) return { kind: "due_soon", text: `${e.dueSoon} due soon` };
  return { kind: "current", text: "All current" };
}

/** 0–100 for the Evidence bar: share of active items on file. */
export function evidencePercent(e: RosterEvidenceSummary): number {
  if (e.total === 0) return e.hasPack ? 100 : 0;
  return Math.round((e.done / e.total) * 100);
}

const blank = (v: unknown) => typeof v !== "string" || v.trim().length === 0;

export type MissingInfoProfile = {
  hire_date?: string | null;
  start_date?: string | null;
  date_of_birth?: string | null;
  home_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

/** Profile basics the roster's "Missing info" chip counts. */
export function missingInfoFor(p: MissingInfoProfile | null | undefined): MissingInfoKey[] {
  const out: MissingInfoKey[] = [];
  if (!resolveHireDate(p?.hire_date, p?.start_date)) out.push("hire_date");
  if (!parseIsoDate(p?.date_of_birth)) out.push("date_of_birth");
  if (blank(p?.home_address)) out.push("address");
  if (blank(p?.emergency_contact_name) || blank(p?.emergency_contact_phone)) {
    out.push("emergency_contact");
  }
  return out;
}

/** Job titles that are really old role names. Access shows as the Owner / Admin badge. */
const LEGACY_ROSTER_ROLES = new Set([
  "platform admin",
  "company admin",
  "supervisor",
  "committee member",
  "program manager",
  "owner",
  "admin",
  "team member",
  "staff",
  "employee",
  "manager",
]);

export function rosterJobLine(
  jobTitle: string | null | undefined,
  position?: string | null,
): string | null {
  const raw = (jobTitle || position || "").trim();
  if (!raw || LEGACY_ROSTER_ROLES.has(raw.toLowerCase())) return null;
  return raw;
}

/* ---------------------------- toolbar state ------------------------------ */

export const ROSTER_FILTERS = ["no_pack", "expiring", "missing", "review", "missing_info"] as const;
export type RosterFilter = (typeof ROSTER_FILTERS)[number];

export const ROSTER_FILTER_LABEL: Record<RosterFilter, string> = {
  no_pack: "No evidence pack",
  expiring: "Expiring soon",
  missing: "Missing items",
  review: "Awaiting review",
  missing_info: "Missing info",
};

/** Tooltip on a filter button with nobody in it. */
export const ROSTER_FILTER_EMPTY: Record<RosterFilter, string> = {
  no_pack: "Everyone has an evidence pack.",
  expiring: "No one is expiring soon.",
  missing: "No one is missing items.",
  review: "Nothing is awaiting review.",
  missing_info: "No one is missing info.",
};

/**
 * ?filter= holds one filter. Old links carried a comma list
 * ("bogus,missing,review"): the first valid key wins.
 */
export function parseRosterFilter(raw: string | null | undefined): RosterFilter | null {
  for (const part of (raw ?? "").split(",")) {
    const f = part.trim() as RosterFilter;
    if (ROSTER_FILTERS.includes(f)) return f;
  }
  return null;
}

/** Clicking a button: the active one clears, any other replaces it. */
export function toggleRosterFilter(
  current: RosterFilter | null,
  clicked: RosterFilter,
): RosterFilter | null {
  return current === clicked ? null : clicked;
}

export function rowMatchesFilter(row: RosterRow, filter: RosterFilter): boolean {
  switch (filter) {
    case "no_pack":
      return !row.evidence.hasPack;
    case "expiring":
      return row.evidence.dueSoon > 0;
    case "missing":
      return row.evidence.missing > 0;
    case "review":
      return row.evidence.awaitingReview > 0;
    case "missing_info":
      return row.missingInfo.length > 0;
  }
}

/** Case-insensitive match on name, email, and team member ID. */
export function rowMatchesSearch(row: RosterRow, q: string | null | undefined): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  return [row.displayName, row.email, row.employeeId].some((v) =>
    (v ?? "").toLowerCase().includes(needle),
  );
}

/** Dropdown value "none" matches people with nothing set. */
function matchesPick(value: string | null, pick: string | null | undefined): boolean {
  if (!pick) return true;
  if (pick === "none") return value === null;
  return value === pick;
}

/** Same, for a multi-value field: any value matches. */
function matchesPickAny(values: readonly string[], pick: string | null | undefined): boolean {
  if (!pick) return true;
  if (pick === "none") return values.length === 0;
  return values.includes(pick);
}

export type RosterQuery = {
  view: "active" | "inactive";
  q?: string | null;
  filter?: RosterFilter | null;
  home?: string | null;
  position?: string | null;
  supervisor?: string | null;
};

/** True when anything narrows the list — shows "Showing X of Y · Clear filter". */
export function rosterQueryIsNarrowed(query: RosterQuery): boolean {
  return !!(
    query.filter ||
    (query.q ?? "").trim() ||
    query.home ||
    query.position ||
    query.supervisor
  );
}

/** Everything but the chips — so chip counts reflect the rest of the toolbar. */
export function baseRosterRows(rows: readonly RosterRow[], query: RosterQuery): RosterRow[] {
  return rows.filter(
    (r) =>
      (query.view === "active" ? r.active : !r.active) &&
      rowMatchesSearch(r, query.q) &&
      matchesPick(r.homeId, query.home) &&
      matchesPickAny(
        r.positions.map((p) => p.key),
        query.position,
      ) &&
      matchesPick(r.supervisorId, query.supervisor),
  );
}

export function filterRosterRows(rows: readonly RosterRow[], query: RosterQuery): RosterRow[] {
  const f = query.filter;
  return baseRosterRows(rows, query).filter((r) => !f || rowMatchesFilter(r, f));
}

export function rosterFilterCounts(rows: readonly RosterRow[]): Record<RosterFilter, number> {
  const out = { no_pack: 0, expiring: 0, missing: 0, review: 0, missing_info: 0 };
  for (const r of rows) for (const f of ROSTER_FILTERS) if (rowMatchesFilter(r, f)) out[f] += 1;
  return out;
}

export const ROSTER_SORT_KEYS = ["name", "start", "login", "evidence"] as const;
export type RosterSortKey = (typeof ROSTER_SORT_KEYS)[number];
export type RosterSort = { key: RosterSortKey; desc: boolean };

/** ?sort=start / ?sort=-login. Default name ascending. */
export function parseRosterSort(raw: string | null | undefined): RosterSort {
  const s = (raw ?? "").trim();
  const desc = s.startsWith("-");
  const key = (desc ? s.slice(1) : s) as RosterSortKey;
  return ROSTER_SORT_KEYS.includes(key) ? { key, desc } : { key: "name", desc: false };
}

export function serializeRosterSort(sort: RosterSort): string | undefined {
  if (sort.key === "name" && !sort.desc) return undefined;
  return `${sort.desc ? "-" : ""}${sort.key}`;
}

/** Clicking a header: same column flips direction, a new column starts ascending. */
export function toggleRosterSort(current: RosterSort, key: RosterSortKey): RosterSort {
  return current.key === key ? { key, desc: !current.desc } : { key, desc: false };
}

/** Higher = needs more attention. Evidence ascending shows the worst first. */
export function evidenceRank(e: RosterEvidenceSummary): number {
  const kind = evidenceLabel(e).kind;
  return { no_pack: 4, missing: 3, review: 2, due_soon: 1, current: 0 }[kind];
}

export function sortRosterRows(rows: readonly RosterRow[], sort: RosterSort): RosterRow[] {
  const byName = (a: RosterRow, b: RosterRow) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  // Blank dates always sort last, whichever direction.
  const byDate = (a: string | null, b: string | null) => {
    if (a === b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return sort.desc ? b.localeCompare(a) : a.localeCompare(b);
  };
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (sort.key === "start") cmp = byDate(a.hireDate, b.hireDate);
    else if (sort.key === "login") cmp = byDate(a.lastSignInAt, b.lastSignInAt);
    else if (sort.key === "evidence") {
      cmp = evidenceRank(b.evidence) - evidenceRank(a.evidence);
      if (sort.desc) cmp = -cmp;
    } else {
      cmp = byName(a, b);
      if (sort.desc) cmp = -cmp;
    }
    return cmp || byName(a, b);
  });
}

export function rosterViewCounts(rows: readonly RosterRow[]): { active: number; inactive: number } {
  let active = 0;
  for (const r of rows) if (r.active) active += 1;
  return { active, inactive: rows.length - active };
}

/* ------------------------------ export ----------------------------------- */

export const ROSTER_CSV_HEADER = [
  "Name",
  "Email",
  "Phone",
  "Position",
  "Access",
  "Home",
  "Supervisor",
  "Start date",
  "Last login",
  "Evidence status",
  "Status",
] as const;

const LEVEL_WORD: Record<RosterRow["accessLevel"], string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Team member",
};

export function rosterCsv(rows: readonly RosterRow[]): string {
  const lines = [ROSTER_CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.displayName,
        r.email,
        r.phone,
        r.positions.map((p) => p.label).join("; "),
        LEVEL_WORD[r.accessLevel],
        r.homeName ?? "",
        r.supervisorName ?? "",
        r.hireDate ?? "",
        r.lastSignInKnown ? (r.lastSignInAt ? r.lastSignInAt.slice(0, 10) : "Never") : "",
        evidenceLabel(r.evidence).text,
        r.active ? "Active" : "Inactive",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/** team-members-YYYY-MM-DD.csv, local calendar day. */
export function rosterCsvFileName(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `team-members-${y}-${m}-${d}.csv`;
}

/* --------------------------- Invited view -------------------------------- */

export type TeamInviteRow =
  | {
      status: "pending";
      invitationId: string;
      token: string;
      userId: string | null;
      name: string | null;
      email: string;
      accessLevel: RosterRow["accessLevel"];
      presetName: string | null;
      createdAt: string;
      expiresAt: string;
      expired: boolean;
    }
  | {
      status: "not_invited";
      invitationId: null;
      token: null;
      userId: string;
      name: string | null;
      email: string;
      accessLevel: RosterRow["accessLevel"];
      presetName: string | null;
      createdAt: string | null;
      expiresAt: null;
      expired: false;
    };

export function isInviteExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t < nowMs;
}

export type InviteSourceInvitation = {
  id: string;
  token: string;
  email: string;
  access_level: string | null;
  access_preset_id: string | null;
  created_at: string;
  expires_at: string;
};

export type InviteSourceMember = {
  userId: string;
  email: string;
  name: string | null;
  accessLevel: RosterRow["accessLevel"];
  presetId: string | null;
  createdAt: string | null;
  /** On the Active roster (member active, profile not archived). */
  active: boolean;
  lastSignInAt: string | null;
  lastSignInKnown: boolean;
};

export function asRosterLevel(raw: string | null | undefined): RosterRow["accessLevel"] {
  return raw === "owner" || raw === "admin" ? raw : "staff";
}

/**
 * Pending invitations (newest first), then active members who have never
 * signed in and have no pending invite ("not_invited").
 */
export function buildTeamInviteRows(args: {
  invitations: readonly InviteSourceInvitation[];
  members: readonly InviteSourceMember[];
  presetNames: ReadonlyMap<string, string>;
  nowMs: number;
}): TeamInviteRow[] {
  const byEmail = new Map(args.members.map((m) => [m.email.trim().toLowerCase(), m]));
  const pendingEmails = new Set<string>();
  const pending: TeamInviteRow[] = [...args.invitations]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((i) => {
      const email = i.email.trim().toLowerCase();
      pendingEmails.add(email);
      const member = byEmail.get(email);
      return {
        status: "pending" as const,
        invitationId: i.id,
        token: i.token,
        userId: member?.userId ?? null,
        name: member?.name ?? null,
        email: i.email,
        accessLevel: asRosterLevel(i.access_level),
        presetName: i.access_preset_id ? (args.presetNames.get(i.access_preset_id) ?? null) : null,
        createdAt: i.created_at,
        expiresAt: i.expires_at,
        expired: isInviteExpired(i.expires_at, args.nowMs),
      };
    });
  const notInvited: TeamInviteRow[] = args.members
    .filter(
      (m) =>
        m.active &&
        m.lastSignInKnown &&
        !m.lastSignInAt &&
        m.email.includes("@") &&
        !pendingEmails.has(m.email.trim().toLowerCase()),
    )
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
    .map((m) => ({
      status: "not_invited" as const,
      invitationId: null,
      token: null,
      userId: m.userId,
      name: m.name,
      email: m.email,
      accessLevel: m.accessLevel,
      presetName: m.presetId ? (args.presetNames.get(m.presetId) ?? null) : null,
      createdAt: m.createdAt,
      expiresAt: null,
      expired: false as const,
    }));
  return [...pending, ...notInvited];
}

/* ---------------------------- viewer scope ------------------------------- */

/**
 * Which of `userIds` the viewer may see on the roster.
 * agency: everyone. assigned: only where access_can_see_staff is true.
 * self: only the viewer. canSee is only called for 'assigned'.
 */
export async function filterByViewerScope(args: {
  scope: "agency" | "assigned" | "self";
  viewerId: string;
  userIds: readonly string[];
  canSee: (userId: string) => Promise<boolean>;
}): Promise<string[]> {
  const { scope, viewerId, userIds, canSee } = args;
  if (scope === "agency") return [...userIds];
  if (scope === "self") return userIds.filter((id) => id === viewerId);
  const verdicts = await Promise.all(userIds.map(async (id) => [id, await canSee(id)] as const));
  return verdicts.filter(([, ok]) => ok).map(([id]) => id);
}

/* ----------------------------- row actions ------------------------------- */

/** React Query keys. They sit under ["members"] / ["invites"] so any invalidation
 *  of those prefixes refreshes the roster too. */
export const rosterQueryKey = (orgId: string | null | undefined) =>
  ["members", orgId ?? null, "team-roster"] as const;
export const teamInvitesQueryKey = (orgId: string | null | undefined) =>
  ["invites", orgId ?? null, "team-invites"] as const;

export type RosterActionKey =
  | "open"
  | "evidence"
  | "caseload"
  | "reset_password"
  | "send_invite"
  | "resend_invite"
  | "deactivate"
  | "reactivate";

export type RosterViewer = {
  userId: string | null;
  isOwner: boolean;
  canCategory: (
    id: "staff_roster" | "staff_hiring" | "staff_compliance",
    min: "view" | "edit",
  ) => boolean;
};

/** The ⋯ menu for one row, in order. Mirrors the server guards (guards.ts). */
export function rowActionKeys(
  row: Pick<
    RosterRow,
    | "userId"
    | "active"
    | "accessLevel"
    | "lastSignInAt"
    | "lastSignInKnown"
    | "pendingInviteId"
    | "email"
  >,
  viewer: RosterViewer,
): RosterActionKey[] {
  const self = !!viewer.userId && viewer.userId === row.userId;
  // Only an Owner may act on an Owner.
  const hiring =
    viewer.canCategory("staff_hiring", "edit") && (row.accessLevel !== "owner" || viewer.isOwner);
  if (!row.active) return hiring ? ["open", "reactivate"] : ["open"];
  const out: RosterActionKey[] = ["open"];
  if (viewer.canCategory("staff_compliance", "view")) out.push("evidence");
  if (viewer.canCategory("staff_roster", "edit")) out.push("caseload");
  if (hiring && !self) out.push("reset_password");
  const neverSignedIn = row.lastSignInKnown && !row.lastSignInAt;
  if (hiring && neverSignedIn && row.email.includes("@")) {
    out.push(row.pendingInviteId ? "resend_invite" : "send_invite");
  }
  if (hiring && !self) out.push("deactivate");
  return out;
}

/** Position dropdown: every position someone holds, sorted; "None" when someone has none. */
export function rosterPositionOptions(
  rows: readonly RosterRow[],
): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();
  let hasNone = false;
  for (const r of rows) {
    if (!r.positions.length) hasNone = true;
    for (const p of r.positions) seen.set(p.key, p.label);
  }
  const out = [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return hasNone ? [...out, { value: "none", label: "None" }] : out;
}

/** Dropdown options from the rows themselves, sorted; "None" when someone has nothing set. */
export function rosterPickOptions(
  rows: readonly RosterRow[],
  id: (r: RosterRow) => string | null,
  label: (r: RosterRow) => string | null,
): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();
  let hasNone = false;
  for (const r of rows) {
    const v = id(r);
    if (v) seen.set(v, label(r) ?? "—");
    else hasNone = true;
  }
  const out = [...seen]
    .map(([value, l]) => ({ value, label: l }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return hasNone ? [...out, { value: "none", label: "None" }] : out;
}
