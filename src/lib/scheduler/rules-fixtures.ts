// Made-up people and shifts for the rule-engine tests. No real data, no PHI.
import { denverWallToIso } from "../denver-date.ts";
import { addDaysKey } from "./time.ts";
import { CODE_QUALIFICATIONS, CPR_KEY, GENERAL_KEY } from "./rules-qualifications.ts";
import type {
  ClientFacts, Finding, QualFile, QualItem, RuleContext, RuleShift, StaffFacts,
} from "./rules-types.ts";

/** A Wednesday. The Sunday-to-Saturday week is 2026-10-11 to 2026-10-17. */
export const DAY = "2026-10-14";
export const SUNDAY = "2026-10-11";

export function at(h: number, m = 0, ymd = DAY): string {
  return denverWallToIso(ymd, h, m);
}

export function addDays(ymd: string, n: number): string {
  return addDaysKey(ymd, n);
}

export function evidence(keys: readonly string[], over: Partial<Record<string, { review?: "pending" | "accepted" | "sent_back"; expires?: string | null }>> = {}): { items: QualItem[]; files: QualFile[] } {
  const items = keys.map((k) => ({
    id: `item-${k}`, requirement_key: k, evidence_type: "upload" as const,
    expires_on: over[k]?.expires === undefined ? "2030-01-01" : over[k]!.expires,
  }));
  const files = keys.map((k) => ({
    id: `file-${k}`, item_id: `item-${k}`, filename: `${k}.pdf`, uploaded_at: "2026-01-01T00:00:00Z",
    review_status: over[k]?.review ?? ("accepted" as const),
  }));
  return { items, files };
}

export const ALL_KEYS: readonly string[] = [
  GENERAL_KEY, CPR_KEY, "abi_training", "mandt_behavior", "driver_license",
  ...new Set(Object.values(CODE_QUALIFICATIONS).flat().map((r) => r.key)),
];

export function shift(over: Partial<RuleShift> = {}): RuleShift {
  return {
    id: "sh1", staffId: "s1", clientId: "c1", teamId: "t1", code: "SLH",
    startsAt: at(9), endsAt: at(11), status: "draft", ...over,
  };
}

export function client(over: Partial<ClientFacts> = {}): ClientFacts {
  return {
    id: "c1", name: "Ben Example", age: 30, custody: "none",
    authorizations: [{ code: "SLH", startDate: "2026-01-01", endDate: null, unitsLeft: 500, approvedOn: "2026-01-01" }],
    teamStaffIds: ["s1", "s2"], doNotScheduleStaffIds: [], ...over,
  };
}

export function staff(over: Partial<StaffFacts> = {}): StaffFacts {
  return { id: "s1", name: "Maria Example", active: true, age: 30, hireDate: "2020-01-01", timeOff: [], ...over };
}

export function auth(code: string, over: Partial<ClientFacts["authorizations"][number]> = {}) {
  return { code, startDate: "2026-01-01", endDate: null, unitsLeft: 500, approvedOn: "2026-01-01", ...over };
}

type CtxOver = {
  client?: Partial<ClientFacts>;
  staff?: Partial<StaffFacts>;
  /** Extra codes to authorize for the default client. */
  codes?: readonly string[];
  shifts?: readonly RuleShift[];
  settings?: RuleContext["settings"];
  evidence?: RuleContext["evidence"];
  today?: string;
  places?: RuleContext["places"];
};

export function ctx(o: CtxOver = {}): RuleContext {
  const c = client(o.client);
  const withCodes = { ...c, authorizations: [...c.authorizations, ...(o.codes ?? []).map((k) => auth(k))] };
  const s2 = staff({ id: "s2", name: "Leo Example" });
  return {
    today: o.today ?? DAY,
    clients: { c1: o.client?.authorizations ? c : withCodes },
    staff: { s1: staff(o.staff), s2 },
    shifts: o.shifts ?? [],
    settings: o.settings ?? {},
    evidence: o.evidence ?? { s1: evidence(ALL_KEYS), s2: evidence(ALL_KEYS) },
    places: o.places,
  };
}

export function has(findings: readonly Finding[], rule: string, level?: "block" | "warn"): boolean {
  return findings.some((f) => f.rule === rule && (!level || f.level === level));
}
