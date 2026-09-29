/**
 * Synthetic True North roster fixtures for Sep 1 CLIENTS + STAFF e2e.
 *
 * Names match the known TNS roster the owner listed. IDs, emails, and
 * Medicaid values are fake — do not treat them as live PHI.
 */
export const ORG_ID = "00000000-0000-4000-a000-000000000001";
export const ORG_NAME = "True North Supports";

export const MAPLE_HOME_ID = "00000000-0000-4000-a000-000000000301";
export const OAK_SLH_ID = "00000000-0000-4000-a000-000000000302";

export const ADMIN_USER_ID = "00000000-0000-4000-a000-000000000010";
export const ADMIN_EMAIL = "roster-admin@example.test";
export const ADMIN_NAME = "Roster Admin";

export const STAFF = {
  jake: {
    id: "00000000-0000-4000-a000-000000000201",
    name: "Jake Probert",
    email: "jake.probert@example.test",
    role: "employee" as const,
    jobTitle: "DSP",
    teamId: MAPLE_HOME_ID,
  },
  harvey: {
    id: "00000000-0000-4000-a000-000000000202",
    name: "Harvey Alisa",
    email: "harvey.alisa@example.test",
    role: "manager" as const,
    jobTitle: "House Manager",
    teamId: MAPLE_HOME_ID,
  },
  tom: {
    id: "00000000-0000-4000-a000-000000000203",
    name: "Tom Jones",
    email: "tom.jones@example.test",
    role: "employee" as const,
    jobTitle: "DSP",
    teamId: OAK_SLH_ID,
  },
  dane: {
    id: "00000000-0000-4000-a000-000000000204",
    name: "Dane Warnick",
    email: "dane.warnick@example.test",
    role: "admin" as const,
    jobTitle: "Platform Admin",
    teamId: null as string | null,
    hiveExec: true,
  },
  admin: {
    id: ADMIN_USER_ID,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: "admin" as const,
    jobTitle: "Company Admin",
    teamId: null as string | null,
  },
} as const;

export const DSP_USER_ID = STAFF.jake.id;

const TOMMY_GOALS = [
  "Community integration — join one community activity each week",
  "Daily living — prepare a simple meal with staff support",
] as const;

const BLAKE_GOALS = ["Health — complete daily hygiene routine independently"] as const;

export const CLIENTS = {
  tommy: {
    id: "00000000-0000-4000-a000-000000000101",
    first_name: "Tommy",
    last_name: "Jones",
    codes: ["DSI", "HHS", "SEI", "SLH"],
    team_id: MAPLE_HOME_ID,
    medicaid_id: "MOCK-TJ-001",
    pcsp_goals: [...TOMMY_GOALS],
  },
  blake: {
    id: "00000000-0000-4000-a000-000000000102",
    first_name: "Blake",
    last_name: "Stevens",
    codes: ["DSI", "HHS"],
    team_id: MAPLE_HOME_ID,
    medicaid_id: "MOCK-BS-002",
    pcsp_goals: [...BLAKE_GOALS],
  },
  stephen: {
    id: "00000000-0000-4000-a000-000000000103",
    first_name: "Stephen",
    last_name: "Prince",
    codes: ["SLH"],
    team_id: OAK_SLH_ID,
    medicaid_id: "MOCK-SP-003",
    pcsp_goals: [] as string[],
  },
  marcus: {
    id: "00000000-0000-4000-a000-000000000104",
    first_name: "Marcus",
    last_name: "Rivera",
    codes: [] as string[],
    team_id: null as string | null,
    medicaid_id: "MOCK-MR-004",
    pcsp_goals: [] as string[],
  },
} as const;

export const TEAMS = [
  {
    id: MAPLE_HOME_ID,
    team_name: "Maple House",
    setting: "residential",
    manager_id: STAFF.harvey.id,
    organization_id: ORG_ID,
    active: true,
  },
  {
    id: OAK_SLH_ID,
    team_name: "Oak SLH",
    setting: "slh",
    manager_id: STAFF.tom.id,
    organization_id: ORG_ID,
    active: true,
  },
];

export const PENDING_INVITE = {
  id: "00000000-0000-4000-a000-000000000401",
  token: "mock-invite-token",
  email: "new.dsp@example.test",
  role: "employee",
  status: "pending",
  organization_id: ORG_ID,
  expires_at: "2026-09-15T00:00:00.000Z",
  created_at: "2026-08-27T00:00:00.000Z",
};

export const STAFF_LIST = [STAFF.admin, STAFF.jake, STAFF.harvey, STAFF.tom, STAFF.dane];

/**
 * Evidence summaries the mocked listTeamRoster returns (the real server fn
 * derives them from evidence_items / evidence_files). One of each roster label:
 * All current, N missing, N due soon, No pack yet.
 */
const EVIDENCE_NONE = {
  hasPack: false,
  total: 0,
  done: 0,
  dueSoon: 0,
  missing: 0,
  awaitingReview: 0,
  skipped: 0,
};
export const ROSTER_EVIDENCE: Record<string, typeof EVIDENCE_NONE> = {
  [STAFF.jake.id]: { ...EVIDENCE_NONE, hasPack: true, total: 4, done: 4 },
  [STAFF.harvey.id]: { ...EVIDENCE_NONE, hasPack: true, total: 5, done: 3, missing: 2 },
  [STAFF.tom.id]: { ...EVIDENCE_NONE, hasPack: true, total: 3, done: 3, dueSoon: 1 },
  [STAFF.dane.id]: EVIDENCE_NONE,
  [ADMIN_USER_ID]: EVIDENCE_NONE,
};

/** Roster Position chips (profiles.staff_type_keys labelled by staff_types). */
export const ROSTER_POSITIONS: Record<string, Array<{ key: string; label: string }>> = {
  [STAFF.jake.id]: [{ key: "dsp", label: "Direct Support Professional" }],
  [STAFF.harvey.id]: [
    { key: "operations_director", label: "Operations Director" },
    { key: "dsp", label: "Direct Support Professional" },
    { key: "hhp", label: "Host Home Provider" },
  ],
  [STAFF.tom.id]: [{ key: "hhp", label: "Host Home Provider" }],
  [STAFF.dane.id]: [{ key: "executive_director", label: "Executive Director" }],
  [ADMIN_USER_ID]: [],
};

/** The agency's staff_types — the Position list on Add / Import team members. */
export const TNS_POSITIONS = [
  { key: "dsp", label: "Direct Support Professional" },
  { key: "executive_assistant", label: "Executive Assistant" },
  { key: "executive_director", label: "Executive Director" },
  { key: "hhp", label: "Host Home Provider" },
  { key: "operations_director", label: "Operations Director" },
];

/** The person createTeamMember / importTeamMembers "adds" in the mocks. */
export const NEW_TEAM_MEMBER = {
  id: "00000000-0000-4000-a000-000000000499",
  name: "Sep Tester",
  email: "sep1.tester@example.test",
  tempPassword: "Mock-Temp-Pass2",
} as const;

/** Mocked org_member_last_sign_ins: the roster admin has never signed in. */
export const LAST_SIGN_IN: Record<string, string | null> = {
  [ADMIN_USER_ID]: null,
  [STAFF.jake.id]: "2026-08-27T12:00:00.000Z",
  [STAFF.harvey.id]: "2026-08-27T12:00:00.000Z",
  [STAFF.tom.id]: "2026-08-27T12:00:00.000Z",
  [STAFF.dane.id]: "2026-08-27T12:00:00.000Z",
};
export const CLIENT_LIST = [CLIENTS.tommy, CLIENTS.blake, CLIENTS.stephen, CLIENTS.marcus];

/** Fake daily_logs rows — IDs and narrative are synthetic, not live PHI. */
export const PENDING_LOG_ID = "00000000-0000-4000-a000-000000000601";
export const APPROVED_LOG_ID = "00000000-0000-4000-a000-000000000602";
export const REJECTED_LOG_ID = "00000000-0000-4000-a000-000000000603";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export const DAILY_LOGS = [
  {
    id: PENDING_LOG_ID,
    organization_id: ORG_ID,
    user_id: STAFF.jake.id,
    client_id: CLIENTS.tommy.id,
    service_code: "HHS",
    log_date: isoDaysAgo(1),
    pcsp_goals_addressed: [...TOMMY_GOALS],
    narrative:
      "Tommy joined a community outing to the library, chose two books, and practiced meal prep at dinner with staff support. Mood was calm all evening.",
    signature_data_url:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
    submitted_at: `${isoDaysAgo(1)}T22:15:00.000Z`,
    created_at: `${isoDaysAgo(1)}T22:15:00.000Z`,
    status: "pending_approval",
    approved_at: null as string | null,
    approved_by: null as string | null,
    denial_reason: null as string | null,
    denied_at: null as string | null,
    denied_by: null as string | null,
    backdated: false,
    submitted_late: false,
    ai_compliance_status: "Verified",
    word_count: 32,
  },
  {
    id: APPROVED_LOG_ID,
    organization_id: ORG_ID,
    user_id: STAFF.jake.id,
    client_id: CLIENTS.blake.id,
    service_code: "HHS",
    log_date: isoDaysAgo(2),
    pcsp_goals_addressed: [...BLAKE_GOALS],
    narrative:
      "Blake completed his morning hygiene routine independently and attended a short walk. No incidents. Evening was quiet.",
    signature_data_url:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
    submitted_at: `${isoDaysAgo(2)}T21:40:00.000Z`,
    created_at: `${isoDaysAgo(2)}T21:40:00.000Z`,
    status: "approved",
    approved_at: `${isoDaysAgo(1)}T14:00:00.000Z`,
    approved_by: ADMIN_USER_ID,
    denial_reason: null as string | null,
    denied_at: null as string | null,
    denied_by: null as string | null,
    backdated: false,
    submitted_late: false,
    ai_compliance_status: "Verified",
    word_count: 22,
  },
  {
    id: REJECTED_LOG_ID,
    organization_id: ORG_ID,
    user_id: STAFF.jake.id,
    client_id: CLIENTS.tommy.id,
    service_code: "HHS",
    log_date: isoDaysAgo(3),
    pcsp_goals_addressed: [...TOMMY_GOALS],
    narrative: "Tommy had a good day.",
    signature_data_url:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
    submitted_at: `${isoDaysAgo(3)}T20:05:00.000Z`,
    created_at: `${isoDaysAgo(3)}T20:05:00.000Z`,
    status: "rejected",
    approved_at: null as string | null,
    approved_by: null as string | null,
    denial_reason: "Please add more detail about the community activity and meal prep.",
    denied_at: `${isoDaysAgo(2)}T16:00:00.000Z`,
    denied_by: ADMIN_USER_ID,
    backdated: true,
    submitted_late: true,
    ai_compliance_status: "Exception",
    word_count: 5,
  },
] as const;

/**
 * Profile page (getTeamMemberProfile) Evidence rows — the real server fn reads
 * evidence_items / evidence_files. Jake: background on file, OIG due, and he
 * transports clients with license + insurance on file. Harvey has no pack.
 */
const evidenceItem = (staffId: string, key: string, over: Record<string, unknown> = {}) => ({
  id: `ev-${staffId.slice(-3)}-${key}`,
  organization_id: ORG_ID,
  subject_type: "staff",
  subject_id: staffId,
  requirement_key: key,
  title: key,
  evidence_type: "upload",
  attestation_text: null,
  cadence: "once",
  sow_cite: null,
  suggested: false,
  sent_to_staff: false,
  visible_to_staff_id: null,
  dual_link_key: null,
  dual_link_peer_id: null,
  expires_on: null,
  first_due_rule: null,
  first_due_on: null,
  document_date: null,
  next_due_on: null,
  renew_years: null,
  send_message: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  ...over,
});
const evidenceFile = (itemId: string) => ({
  id: `file-${itemId}`,
  organization_id: ORG_ID,
  item_id: itemId,
  storage_path: `${ORG_ID}/${itemId}.pdf`,
  filename: "scan.pdf",
  attested_at: null,
  attested_by: null,
  attestation_text_snapshot: null,
  uploaded_by: ADMIN_USER_ID,
  uploaded_at: "2026-07-02T15:00:00.000Z",
  notes: null,
});
const JAKE_ITEMS = [
  evidenceItem(STAFF.jake.id, "background_screening", { document_date: "2026-07-02" }),
  evidenceItem(STAFF.jake.id, "oig_exclusion", { first_due_on: "2099-01-01" }),
  evidenceItem(STAFF.jake.id, "driver_license"),
  evidenceItem(STAFF.jake.id, "auto_insurance_proof"),
];
export const PROFILE_EVIDENCE: Record<
  string,
  { items: Array<ReturnType<typeof evidenceItem>>; files: Array<ReturnType<typeof evidenceFile>> }
> = {
  [STAFF.jake.id]: {
    items: JAKE_ITEMS,
    files: JAKE_ITEMS.filter((i) => i.requirement_key !== "oig_exclusion").map((i) =>
      evidenceFile(i.id),
    ),
  },
};

/** Caseload tab (getMemberCaseload): explicit codes per client. */
export const PROFILE_CASELOAD: Record<string, Array<{ clientId: string; codes: string[] }>> = {
  [STAFF.jake.id]: [{ clientId: CLIENTS.tommy.id, codes: ["DSI", "SLH"] }],
};

/** Notes tab (listStaffNotes), newest first. */
export const PROFILE_NOTES = [
  {
    id: "00000000-0000-4000-a000-000000000701",
    kind: "praise",
    body: "Stayed late to cover the Maple overnight.",
    createdAt: "2026-09-20T18:00:00.000Z",
    authorId: ADMIN_USER_ID,
    authorName: ADMIN_NAME,
  },
];

/** Activity tab (getMemberActivity) account history. */
export const PROFILE_ACCOUNT_ACTIVITY = [
  {
    id: "00000000-0000-4000-a000-000000000801",
    change_type: "member_created",
    changed_by_name: ADMIN_NAME,
    created_at: "2025-01-15T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-a000-000000000802",
    change_type: "invite_sent",
    changed_by_name: ADMIN_NAME,
    created_at: "2025-01-15T00:05:00.000Z",
  },
];
