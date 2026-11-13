// Types for the scheduler rule engine (rules.ts). Plain data in, findings out:
// nothing here touches the database. Callers (server functions, S4+) load the
// facts and build a RuleContext; the rules only read it.

/** "reason" = the action may go ahead only with a typed reason (Decision 4). */
export type Level = "block" | "reason" | "warn";

/** An agency's choice per rule (Decision 4). Contract rules have no "off". */
export type Strength = "off" | "warn" | "reason" | "block";

/** A suggested next step. `href` is an in-app link (e.g. a person's Evidence row). */
export type Fix = { label: string; href?: string; code?: string };

export type Finding = {
  /** Stable machine name of the rule, e.g. "no_authorization". */
  rule: string;
  level: Level;
  /** One plain line for the screen. */
  message: string;
  fix?: Fix;
  /** Which shift the finding is about (set by evaluateShifts). */
  shiftId?: string;
};

/** Where a shift happens, for respite and day-support rules. */
export type PlaceKind = "client_home" | "staff_home" | "relative_home" | "facility" | "community" | "site";

export type RuleShift = {
  id: string;
  staffId: string | null;
  /** Null for RHS home shifts and DSG session shifts (Decision 1). */
  clientId: string | null;
  teamId: string | null;
  code: string;
  startsAt: string;
  endsAt: string;
  parentShiftId?: string | null;
  status?: string | null;
  /** Staff confirmed awake for the overnight (SLH/SLN/CMP/CMS). */
  awakeConfirmed?: boolean;
  /** Minutes of the shift the staff was confirmed awake (when partly asleep). */
  awakeMinutes?: number | null;
  place?: PlaceKind | null;
  address?: string | null;
  telehealth?: boolean;
  /** The staff member drives the client during this shift. */
  driving?: boolean;
  /** Extended by a supervisor as mandated overtime (Decision 20). */
  holdover?: boolean;
  /** Clients present for a group shift (DSG, DSP, EPR, SED, RPS, RP2-RP5 groups). */
  groupClientIds?: readonly string[];
  /** Staff on the same group window, including this one. */
  groupStaffCount?: number;
  /** Behavior consult shift records direct support or transport (not allowed). */
  directSupport?: boolean;
  transport?: boolean;
  /** Respite given in the host's own home or in a different home (HHS/PPS rules). */
  respite?: "own_home" | "other_home" | null;
  /** Which day of an unbroken run of respite days this is (1-based). */
  respiteConsecutiveDay?: number;
  /** PN2 billing kind of the shift. */
  pn2Kind?: "daily" | "session" | null;
  /** In-person visit on this day (PN2 daily rate). */
  inPerson?: boolean;
  /** Reason on file for 4+ days of PN2 in a week. */
  reason?: string | null;
  /** RHS shift is a 1:1 or 2:1 enhanced-staffing block. */
  staffingRatio?: { staff: number; clients: number } | null;
  /** Time-window staffing requirements for a home slot or session. */
  windowRequirements?: readonly WindowRequirement[];
  /** Set on van run shifts (Decision 17); the driver needs 18+ and a driver file. */
  vanRouteId?: string | null;
};

export type WindowRequirement = {
  /** HH:MM Denver wall clock. */
  from: string;
  to: string;
  /** Qualification key the staff on the shift must hold, e.g. "med_trained". */
  qualificationKey: string;
  label: string;
  count: number;
};

export type Authorization = {
  code: string;
  startDate: string;
  endDate: string | null;
  /** Units still available (null = unknown, not checked). */
  unitsLeft: number | null;
  /** Date the state approved the 1056 (Decision 13). */
  approvedOn: string | null;
  /** Worksheet weekly hours target for this code, if any. */
  weeklyHoursTarget?: number | null;
};

export type ClientRatioEntry = {
  code: string;
  /** Staff per clients, e.g. { staff: 1, clients: 6 } for 1:6. */
  staff: number;
  clients: number;
  /** A person entered/confirmed it; false means we are assuming a default. */
  confirmed: boolean;
};

export type Absence = {
  kind: "hospital" | "jail";
  /** Admission / booking day (blocked). */
  startDate: string;
  /** Discharge / release day (allowed). Null while still away. */
  endDate: string | null;
};

export type ClientPreference = {
  key: string;
  label: string;
  /** Match against the staff member: e.g. same gender. */
  requiresStaffGender?: "female" | "male" | null;
  /** Codes the preference applies to (empty = all). */
  codes?: readonly string[];
  /** Agency made this one a block. */
  block?: boolean;
};

export type ClientFacts = {
  id: string;
  name: string;
  age: number | null;
  custody?: "none" | "dcfs" | "djjys";
  authorizations: readonly Authorization[];
  ratios?: readonly ClientRatioEntry[];
  teamStaffIds: readonly string[];
  /** Codes each team member is assigned for this client (staff_assignments.service_codes). */
  teamCodes?: Readonly<Record<string, readonly string[]>>;
  doNotScheduleStaffIds: readonly string[];
  /** Why each person is on the do-not-schedule list, when a reason was given. */
  doNotScheduleReasons?: Readonly<Record<string, string>>;
  absences?: readonly Absence[];
  hasForm930?: boolean;
  hasRightsModification?: boolean;
  hasForm929?: boolean;
  livesWithRelativeOrGuardian?: boolean;
  /** Agency provides this client's RHS, HHS, PPS or SLH (PN1 rule). */
  agencyIsResidentialProvider?: boolean;
  hasPn2Oversight?: boolean;
  /** Written Director approval for TFB alongside RHS/HHS/PPS/SLH. */
  tfbDirectorApproval?: boolean;
  /** SJD hours already billed, and RFS approval for up to 120. */
  sjdHoursUsed?: number;
  sjdExtendedApproval?: boolean;
  /** EPR months already served (24-month limit) and prior authorization. */
  eprMonthsServed?: number;
  eprExtensionApproved?: boolean;
  /** Share of EPR time in the community this month (0..1). */
  eprCommunityShare?: number | null;
  /** Respite days used in the Plan Year, by kind. */
  respiteDaysOwnHome?: number;
  respiteDaysOtherHome?: number;
  /** HHS/PPS home facts. */
  homeId?: string | null;
  homeClientCount?: number;
  homeException?: boolean;
  homeHasOtherCodeClients?: "HHS" | "PPS" | null;
  /** Day-support days billed this month (MTP cap). */
  dayServiceDaysBilled?: number;
  mtpDaysBilled?: number;
  preferences?: readonly ClientPreference[];
  /** Behavior support in place (behavior training rule). */
  behaviorSupport?: boolean;
  hasAbi?: boolean;
  /** ELS days billed this PCSP year, and absence days still unused on the worksheet. */
  elsDaysUsed?: number;
  absenceDaysLeft?: number;
  /** The 4 documented conditions are on file for HHS/PPS staff delivering ELS (§10.4(4)). */
  elsHostConditionsOnFile?: boolean;
  /** Services the agency already bills for this client in the month, by code (RHS/HHS/PPS/SLH). */
  otherCodes?: readonly string[];
  /** Overnight respite falls in the same 24 hours (SL 4-hour cap). */
  overnightRespiteDays?: readonly string[];
};

export type StaffFacts = {
  id: string;
  name: string;
  active: boolean;
  /** Age on the shift date, or null when unknown. */
  age: number | null;
  gender?: "female" | "male" | null;
  hireDate: string | null;
  hasDriversLicense?: boolean | null;
  /** Relationship to a client, by client id (SLN/CMP/CMS picking, §32.6). */
  relationTo?: Readonly<Record<string, "parent" | "step_parent" | "guardian" | "spouse" | "other">>;
  /** Staff-declared hours worked elsewhere, by Denver day. */
  outsideHours?: Readonly<Record<string, number>>;
  /** Approved time off as [startYmd, endYmd] inclusive. */
  timeOff: ReadonlyArray<readonly [string, string]>;
  /** Weekly availability windows by weekday 0=Sun, HH:MM; empty/undefined = open. */
  availability?: Readonly<Record<number, ReadonlyArray<readonly [string, string]>>>;
  /** Last day the person was the staff of a home in own residence (respite RP2). */
  householdUnder14?: number;
  /** HHS/PPS host staff (ELS rule). */
  isHostStaff?: boolean;
  /** Nursing license held: LPN or RN (nursing tier rule uses Evidence too). */
  licenseTier?: "lpn" | "rn" | null;
};

export type Place = { id: string; name: string; licensedCapacity?: number | null };

export type AgencySettings = {
  /** Strength per rule name (rules-strength.ts). A missing key means the rule's default. */
  rules?: Readonly<Record<string, Strength>>;
  overtimeThresholdHours?: number;
  minRestHours?: number;
  travelGapMinutes?: number;
  /** Raise the minimum staff age floor from 16 to 18 (Decision 4). */
  minAge18?: boolean;
};

export type RuleContext = {
  /** Today in Denver (YYYY-MM-DD) for assumed-ratio and grace checks. */
  today: string;
  clients: Readonly<Record<string, ClientFacts>>;
  staff: Readonly<Record<string, StaffFacts>>;
  places?: Readonly<Record<string, Place>>;
  /** Other shifts already on the books (any staff/client) around the proposed ones. */
  shifts: readonly RuleShift[];
  settings: AgencySettings;
  /** Evidence rows per staff id, read by qualificationsOnDate. */
  evidence: Readonly<Record<string, QualEvidence>>;
  /** Person-specific training keys required per client id. */
  personTrainingKeys?: Readonly<Record<string, readonly string[]>>;
};

export type QualItem = {
  id: string;
  requirement_key: string;
  evidence_type?: "upload" | "attestation";
  expires_on?: string | null;
  next_due_on?: string | null;
  opted_out_at?: string | null;
};

export type QualFile = {
  item_id: string;
  review_status?: "pending" | "accepted" | "sent_back" | null;
  uploaded_at?: string | null;
  attested_at?: string | null;
  storage_path?: string | null;
  filename?: string | null;
  id?: string;
};

export type QualEvidence = { items: readonly QualItem[]; files: readonly QualFile[] };
