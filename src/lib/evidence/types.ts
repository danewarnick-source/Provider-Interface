/**
 * Evidence Phase 1 — suggestion-only people × requirements tracker.
 * Packs are curated in code from the product catalog. Providers opt in.
 */

export const EVIDENCE_SUBJECTS = ["staff", "client", "company"] as const;
export type EvidenceSubject = (typeof EVIDENCE_SUBJECTS)[number];

export const EVIDENCE_TYPES = ["upload", "attestation"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_CADENCES = [
  "once",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "every_2_years",
  "every_5_years",
  "keep_current",
] as const;
export type EvidenceCadence = (typeof EVIDENCE_CADENCES)[number];

export const FIRST_DUE_RULES = [
  "before_first_shift",
  "hire_30",
  "hire_90",
  "hire_180",
  "set_date",
] as const;
export type FirstDueRule = (typeof FIRST_DUE_RULES)[number];

export type RenewYears = 1 | 2 | null;

export const EVIDENCE_CELL_STATUSES = ["done", "missing"] as const;
export type EvidenceCellStatus = (typeof EVIDENCE_CELL_STATUSES)[number];

export const SERVICE_CODE_FLAGS = [
  "HHS",
  "SLN",
  "SLH",
  "SEI",
  "DSI",
  "RHS",
  "PPS",
  "SJD",
  "SEE",
  "SED",
  "SEC",
  "SJP",
  "SJR",
  "EPR",
  "DSG",
  "DSP",
  "BC1",
  "BC2",
  "BC3",
  "PM1",
  "PM2",
  "PN1",
  "PN2",
  "PBA",
  "CMP",
  "CMS",
  "ELS",
  "TFB",
  "HSQ",
  "RP2",
  "RP3",
  "RP4",
  "RP5",
  "RPS",
  "MTP",
  "PAC",
  "COM",
] as const;
export type ServiceCodeFlag = (typeof SERVICE_CODE_FLAGS)[number];

/** Employees quiz — every SOW tab with discrete file evidence (not notes/EVV/summaries). */
export const STAFF_QUIZ_CODES: readonly ServiceCodeFlag[] = SERVICE_CODE_FLAGS;

export const CLIENT_QUIZ_CODES: readonly ServiceCodeFlag[] = [
  "HHS",
  "PPS",
  "RHS",
  "SLN",
  "SLH",
  "SEI",
  "SJD",
  "SEE",
  "SED",
  "DSI",
  "DSG",
  "DSP",
  "BC1",
  "BC2",
  "BC3",
];

export type DualLinkKind = "host_home_cert";

export type EvidenceHelpLink = {
  label: string;
  href: string;
};

export type EvidenceRequirementDef = {
  key: string;
  title: string;
  shortLabel: string;
  evidenceType: EvidenceType;
  attestationText: string | null;
  cadence: EvidenceCadence;
  sowCite: string;
  /** Plain-English first-due / next-due line. Never “once” or “keep current”. */
  cadenceDisplay: string;
  dueDefault: {
    firstDueRule: FirstDueRule;
    renewYears: RenewYears;
  };
  why: string;
  links: readonly EvidenceHelpLink[];
  subject: EvidenceSubject;
  dualLink: DualLinkKind | null;
};

export type QuestionnaireAnswers = {
  subject: EvidenceSubject;
  serviceCodes: ServiceCodeFlag[];
  /** Staff default is true. Office-only roles may opt out. */
  transportsPeople: boolean;
  worksWithAbi: boolean;
  maySupportAggressiveBehavior: boolean;
  includeCompanyCustoms: boolean;
};

export type EvidencePackDef = {
  key: string;
  title: string;
  chip: string;
  subject: EvidenceSubject;
  description: string;
  requirementKeys: readonly string[];
  when: (answers: QuestionnaireAnswers) => boolean;
};

export type SuggestedPack = {
  pack: EvidencePackDef;
  reason: string;
};

export type EvidenceItemRow = {
  id: string;
  organization_id: string;
  subject_type: EvidenceSubject;
  subject_id: string;
  requirement_key: string;
  title: string;
  evidence_type: EvidenceType;
  attestation_text: string | null;
  cadence: EvidenceCadence;
  sow_cite: string | null;
  suggested: boolean;
  sent_to_staff: boolean;
  visible_to_staff_id: string | null;
  dual_link_key: DualLinkKind | null;
  dual_link_peer_id: string | null;
  expires_on: string | null;
  first_due_rule: FirstDueRule | null;
  first_due_on: string | null;
  document_date: string | null;
  next_due_on: string | null;
  renew_years: RenewYears;
  /** Admin note attached when sending to an employee. Optional; column may be missing live. */
  send_message: string | null;
  created_at: string;
  updated_at: string;
};

export type EvidenceFileRow = {
  id: string;
  organization_id: string;
  item_id: string;
  storage_path: string | null;
  filename: string | null;
  attested_at: string | null;
  attested_by: string | null;
  attestation_text_snapshot: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  notes: string | null;
};

export type EvidencePerson = {
  id: string;
  full_name: string;
  initials: string;
  subtitle: string | null;
  /** Employee hire/start date (YYYY-MM-DD). Null when missing or not a staff row. */
  hire_date?: string | null;
};

export const EVIDENCE_LIABILITY_TEXT =
  "These packs are suggestions only, based on common SOW topics. They are not a complete legal review and not a determination that this agency is in compliance. The provider remains ultimately responsible for knowing and meeting the obligations in its own contract, Scope of Work, and applicable Utah / DSPD rules. Verify every row against your SOW before you apply it, and add anything that is missing.";

export const EVIDENCE_UNCHECK_TITLE = "Are you sure?";
export const EVIDENCE_UNCHECK_WARNING = "This was found to be a requirement in the SOW.";

export const EVIDENCE_STORAGE_UNAVAILABLE = "Evidence storage isn’t set up on this database yet.";

export const EVIDENCE_SEND_MESSAGE_UNAVAILABLE =
  "Sent to the employee. The message could not be saved on this database yet.";

export const EVIDENCE_PUSH_TITLE = "New evidence item";
export const EVIDENCE_PUSH_BODY =
  "Your agency assigned an evidence item. Open Evidence on your phone to upload or attest.";
export const EVIDENCE_PUSH_LINK = "/dashboard/my-evidence";
