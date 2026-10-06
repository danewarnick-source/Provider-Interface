/**
 * Caseload / punch-pad code resolution.
 *
 * Every `staff_assignments` row lists its codes explicitly. NULL or [] is
 * never "all codes" — it grants nothing. A staff member may see and clock
 * into a code only when it is both assigned to them AND currently
 * authorized for the client. Client codes come from `authorized_dspd_codes`
 * first, then `job_code` (legacy).
 */

/** client_id → the codes this staff member is assigned for that client. */
export type AssignmentMap = Map<string, Set<string>>;

/** Trimmed, upper-cased service code; "" when blank. */
export function normalizeServiceCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

/** Trimmed, upper-cased, de-duplicated, blanks dropped, first-seen order kept. */
export function normalizeServiceCodes(raw: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw) ? raw : []) {
    const code = normalizeServiceCode(item);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/**
 * The client's currently authorized codes: union of authorized_dspd_codes and
 * job_code, trimmed, upper-cased, de-duplicated. The staff_assignments
 * explicit-codes backfill migration computes exactly this in SQL.
 */
export function clientAuthorizedCodes(client: {
  job_code?: string[] | null;
  authorized_dspd_codes?: string[] | null;
}): string[] {
  return normalizeServiceCodes([
    ...(Array.isArray(client.authorized_dspd_codes) ? client.authorized_dspd_codes : []),
    ...(Array.isArray(client.job_code) ? client.job_code : []),
  ]);
}

/** The explicit codes on one staff_assignments row. NULL / [] → empty (grants nothing). */
export function assignmentCodes(serviceCodes: readonly unknown[] | null | undefined): string[] {
  return normalizeServiceCodes(serviceCodes);
}

/**
 * Build a staff member's AssignmentMap from their staff_assignments rows.
 * Rows with NULL or [] codes contribute nothing; duplicate rows for one
 * client merge their codes.
 */
export function buildAssignmentMap(
  rows: ReadonlyArray<{ client_id: string; service_codes: readonly unknown[] | null }>,
): AssignmentMap {
  const map: AssignmentMap = new Map();
  for (const r of rows) {
    const codes = assignmentCodes(r.service_codes);
    if (codes.length === 0) continue;
    const prev = map.get(r.client_id);
    if (prev) codes.forEach((c) => prev.add(c));
    else map.set(r.client_id, new Set(codes));
  }
  return map;
}

/**
 * Codes this staff member may use for a client: client's authorized codes ∩
 * assigned codes. [] while assignments are still loading (map undefined) and
 * [] when there is no assignment — never "everything".
 */
export function allowedCodesFor(
  map: AssignmentMap | undefined,
  clientId: string,
  clientCodes: string[],
): string[] {
  if (!map) return [];
  const allow = map.get(clientId);
  if (!allow || allow.size === 0) return [];
  return normalizeServiceCodes(clientCodes).filter((c) => allow.has(c));
}

/** True when this assignment row lists the code (NULL / [] never covers anything). */
export function assignmentCoversCode(
  serviceCodes: readonly unknown[] | null | undefined,
  code: string,
): boolean {
  const want = normalizeServiceCode(code);
  return !!want && assignmentCodes(serviceCodes).includes(want);
}

/**
 * Validate a requested explicit code list against the client's authorized
 * codes. Returns the normalized list ([] means "remove the assignment").
 * Throws when any code is not authorized for the client.
 */
export function resolveStaffClientCodes(
  requested: readonly unknown[],
  authorized: string[],
): string[] {
  const codes = normalizeServiceCodes(requested);
  if (requested.length > 0 && codes.length === 0) {
    throw new Error("Pick at least one service code");
  }
  const allowed = new Set(normalizeServiceCodes(authorized));
  const unknown = codes.filter((c) => !allowed.has(c));
  if (unknown.length > 0) {
    throw new Error(
      `Service code${unknown.length === 1 ? "" : "s"} not authorized for this client: ${unknown.join(", ")}`,
    );
  }
  return codes;
}

/** Existing explicit codes plus one more (order kept, no dupes). */
export function withCodeAdded(
  current: readonly unknown[] | null | undefined,
  code: string,
): string[] {
  return normalizeServiceCodes([...(Array.isArray(current) ? current : []), code]);
}

/** Existing explicit codes minus one. [] means the assignment row should be deleted. */
export function withCodeRemoved(
  current: readonly unknown[] | null | undefined,
  code: string,
): string[] {
  const drop = normalizeServiceCode(code);
  return assignmentCodes(current).filter((c) => c !== drop);
}

/**
 * Codes a Smart Import assignment commits: the source's codes that the client
 * is authorized for, or — when the source lists none — all of the client's
 * authorized codes, written out explicitly. [] means nothing can be written
 * (client has no authorized codes, or none of the source codes are).
 */
export function importAssignmentCodes(
  sourceCodes: readonly unknown[] | null | undefined,
  authorized: string[],
): string[] {
  const auth = normalizeServiceCodes(authorized);
  const source = normalizeServiceCodes(sourceCodes);
  if (source.length === 0) return auth;
  const allowed = new Set(auth);
  return source.filter((c) => allowed.has(c));
}

/** Authorized codes nobody is assigned to yet (for "No staff assigned to {code} yet"). */
export function uncoveredCodes(
  authorized: string[],
  assignments: ReadonlyArray<{ service_codes: readonly unknown[] | null }>,
): string[] {
  const covered = new Set<string>();
  for (const a of assignments) assignmentCodes(a.service_codes).forEach((c) => covered.add(c));
  return normalizeServiceCodes(authorized).filter((c) => !covered.has(c));
}

/**
 * First assigned code, else "". Never falls back to the client's other
 * authorized codes (a code not assigned to this staff member) and never
 * invents SEI — that opened Punch pad for Host Home people with no codes.
 */
export function defaultCaseloadCode(assigned: string[]): string {
  for (const raw of assigned) {
    const code = String(raw ?? "").trim();
    if (code) return code;
  }
  return "";
}

/** True when this person's assigned/authorized codes include a host-home daily code. */
export function hasHostHomeDailyCode(codes: string[]): boolean {
  return codes.some((c) => {
    const u = String(c ?? "")
      .trim()
      .toUpperCase();
    return u === "HHS" || u === "PPS" || u === "MTP";
  });
}

/**
 * True when every assigned code is host-home daily (hosts do not clock).
 * Takes an AssignmentMap value (Set) or an array. No codes → false: an
 * empty assignment is not a host-home assignment, it is no assignment.
 */
export function isHostHomeOnlyAssignment(codes: Iterable<string> | null | undefined): boolean {
  const cleaned = normalizeServiceCodes(codes ? Array.from(codes) : []);
  if (cleaned.length === 0) return false;
  return cleaned.every((u) => u === "HHS" || u === "PPS" || u === "MTP");
}

/** True when assigned/authorized codes include Host Home Supports. */
export function hasHhsCode(codes: string[]): boolean {
  return codes.some(
    (c) =>
      String(c ?? "")
        .trim()
        .toUpperCase() === "HHS",
  );
}

/** First clockable code (DSI, SLH, SEI, RHS, …). Empty when none. Hosts never clock HHS/PPS/MTP. */
export function firstClockableCode(codes: string[]): string {
  for (const raw of codes) {
    const code = String(raw ?? "").trim();
    const u = code.toUpperCase();
    if (code && u !== "HHS" && u !== "PPS" && u !== "MTP") return code;
  }
  return "";
}

/**
 * Person has HHS plus at least one clockable code on file (DSI/SLH/SEI/…).
 * Codes on file are NOT permission to paint a start-punch button onto the
 * caseload card. Time clock on that card is only for an already-open punch.
 */
export function isDualHhsAndClockable(codes: string[]): boolean {
  return hasHhsCode(codes) && !!firstClockableCode(codes);
}

/** Host-home daily-note code for labels. Prefer HHS; else PPS/MTP. */
export function hostHomeDailyNoteCode(codes: string[]): string {
  for (const raw of codes) {
    const u = String(raw ?? "")
      .trim()
      .toUpperCase();
    if (u === "HHS") return "HHS";
  }
  for (const raw of codes) {
    const u = String(raw ?? "")
      .trim()
      .toUpperCase();
    if (u === "PPS" || u === "MTP") return u;
  }
  return "HHS";
}

/** Caseload daily-note CTA. "Complete" only when today's note already exists. */
export function caseloadDailyNoteLabel(opts: {
  code?: string | null;
  alreadyDoneToday?: boolean;
}): string {
  const code = String(opts.code ?? "").trim() || "HHS";
  return opts.alreadyDoneToday ? `Complete daily note (${code})` : `Open daily note (${code})`;
}

/** Caseload end-shift CTA. CODE is the job on that open punch. */
export function caseloadTimeClockLabel(code?: string | null): string {
  const c = String(code ?? "").trim();
  return c ? `End shift (${c})` : "End shift";
}

/**
 * What the caseload card may show.
 * Daily note: every host-home / HHS person, every day — even with DSI/SLH/SEI
 * on file or a scheduled clockable shift. Time clock: only an in-progress
 * open punch. A scheduled shift is not enough; start that from Punch pad.
 */
export function caseloadCardActions(opts: {
  codes: string[];
  isOnTheClock: boolean;
  hasClockableShiftToday?: boolean;
  /** Today's HHS daily note is already filed — drop the open-work CTA. */
  dailyNoteDoneToday?: boolean;
}): { showDailyNote: boolean; showTimeClock: boolean } {
  void opts.hasClockableShiftToday;
  return {
    showDailyNote: hasHostHomeDailyCode(opts.codes) && !opts.dailyNoteDoneToday,
    showTimeClock: !!opts.isOnTheClock,
  };
}

/**
 * Today's surface for this person is the host-home daily note.
 * True whenever they have a host-home code and are not already punched in.
 * A clockable code on file or a scheduled DSI/SLH/SEI shift today must not
 * flip this into a start-punch card.
 */
export function isHostHomeDailyNoteCard(opts: {
  codes: string[];
  todayJobCode?: string | null;
  isOnTheClock?: boolean;
}): boolean {
  void opts.todayJobCode;
  if (!hasHostHomeDailyCode(opts.codes)) return false;
  if (opts.isOnTheClock) return false;
  return true;
}

/**
 * Stack daily note + open time clock on one card.
 * Only when this person is HHS/host-home AND the staff member already has
 * an in-progress punch. Never because they have a clockable code on file
 * or a scheduled shift today.
 */
export function stackDualCaseloadActions(opts: {
  /** Allowed codes (assigned ∩ authorized) — an AssignmentMap Set or array. Empty → false. */
  codes: Iterable<string> | null | undefined;
  isHostHomeDailyNoteCard: boolean;
  hasClockableShiftToday: boolean;
  isOnTheClock: boolean;
}): boolean {
  void opts.isHostHomeDailyNoteCard;
  const codes = normalizeServiceCodes(opts.codes ? Array.from(opts.codes) : []);
  if (codes.length === 0) return false;
  const actions = caseloadCardActions({
    codes,
    isOnTheClock: opts.isOnTheClock,
    hasClockableShiftToday: opts.hasClockableShiftToday,
  });
  return actions.showDailyNote && actions.showTimeClock;
}
