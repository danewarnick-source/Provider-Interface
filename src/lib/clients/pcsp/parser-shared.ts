// Shared types and small helpers for the USTEPS PCSP reader (parser*.ts).
// Plain code, no AI. Anything the reader can't place is reported as an
// issue, never guessed.

export type Issue = { level: "error" | "warn" | "info"; page?: number; message: string };
export type Provider = { code: string; provider: string; ours: boolean };
export type HealthNeed = { category: string; description: string };
export type Support = {
  support: string; details: string; start: string | null; end: string | null;
  providers: Provider[]; ourCodes: string[]; naturalSupport: string; otherSupport: string;
  healthNeeds: HealthNeed[]; page: number;
};
export type Goal = {
  goal: string; domain: string; currentStatus: string; strengths: string; barriers: string;
  successPerson: string; successTeam: string; supports: Support[]; page: number;
};
export type NonGoalSupport = { support: string; details: string; start: string | null; end: string | null };
export type PurchasedService = {
  code: string; name: string; unitType: string; units: number | null; start: string | null; end: string | null; page: number;
};
export type BudgetLine = {
  code: string; kind: string; provider: string; ours: boolean; start: string; end: string;
  rate: number; maxMonthlyUnits: number; annualUnits: number; total: number;
};
export type Risk = { risk: string; response: string; responseTime: string; notes: string };
export type AboutMeRow = { domain: string; label: string; note: string; source: string };
export type LastYearGoal = { goal: string; ongoing: boolean | null; status: string };

export type PcspResult = {
  plan: { start: string | null; end: string | null; activatedOn: string | null; status: string | null; meetingDate: string | null };
  person: { name: string; pid: string; residentialAddress: string; mailingAddress: string; phone: string;
    supportCoordinator: { name: string; email: string; phone: string; company: string } };
  goals: Goal[];
  nonGoalSupports: NonGoalSupport[];
  purchasedServices: PurchasedService[];
  budget: BudgetLine[];
  risks: Risk[];
  aboutMe: AboutMeRow[];
  lastYearGoals: LastYearGoal[];
  issues: Issue[];
};

export type PcspOptions = { agencyName: string; agencyCodes: string[] };

/** One body line with the page it came from. */
export type L = { page: number; y: number; text: string };

export const SECTIONS = [
  "Personal Information", "Pre-Planning", "Annual Review for Goals", "Annual Review for Non Goal Supports",
  "Annual Review for Provider Services", "Planning Tools", "Plan Meeting Minutes", "Action Plan",
  "Goals and Supports", "Non Goal Supports", "DSPD Purchased Services", "Plan Budget", "Scope of Services",
  "Backup Data", "List of Identified Risks", "Emergency Contacts", "Signatures", "Plan Activation Comments",
];
export const DOMAINS = ["Daily Life Employment", "Community Living", "Safety & Security", "Healthy Living",
  "Social Spirituality", "Citizenship & Advocacy"];
export const LABEL = /^(\s*)([A-Z][A-Za-z ()/&'?-]{1,40}?):(\s+(.*))?$/;

export const norm = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b(LLC|INC|CORP|CO)\b/g, "").replace(/\s+/g, " ").trim();
export const squash = (s: string) => s.replace(/\s+/g, " ").trim();
export const usDate = (s: string | undefined | null) => {
  const m = s && s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};
export const longDate = (s: string) => {
  const m = s.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})/);
  return m && MONTHS[m[1]] ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}` : null;
};
export const indent = (t: string) => t.length - t.trimStart().length;

/** "Is this provider name our agency?" by normalized legal name. */
export function ourAgencyMatcher(agencyName: string): (provider: string) => boolean {
  const agency = norm(agencyName);
  return (p: string) => {
    const n = norm(p);
    return !!agency && !!n && (n.includes(agency) || agency.includes(n));
  };
}

export type Field = { label: string; value: string; page: number; y: number; idx: number };

/** Generic "Label: value" reader with multi-line values. */
export function readFields(lines: L[]): Field[] {
  const out: Field[] = [];
  let last: (Field & { col: number }) | null = null;
  lines.forEach((l, idx) => {
    const m = l.text.match(LABEL);
    if (m && indent(l.text) < 14) {
      const col = m[4] ? l.text.indexOf(m[4], m[1].length + m[2].length) : 99;
      last = { label: m[2].trim(), value: (m[4] || "").trim(), page: l.page, y: l.y, idx, col };
      out.push(last);
    } else if (last && indent(l.text) >= Math.min(last.col, 24) - 3) {
      last.value = (last.value + " " + l.text.trim()).trim();
    } else last = null;
  });
  return out;
}

/** "Start Date: 09/01/2026   End Date: 08/31/2027" → ISO dates. */
export function supportDates(v: string): { start: string | null; end: string | null } {
  return { start: usDate(v.match(/Start Date:\s*(\S+)/)?.[1]), end: usDate(v.match(/End Date:\s*(\S+)/)?.[1]) };
}
