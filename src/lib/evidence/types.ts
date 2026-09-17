/**
 * Evidence Phase 1 — suggestion-only people × requirements tracker.
 * Not a compliance engine. Packs are curated in code; providers opt in.
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
  "keep_current",
] as const;
export type EvidenceCadence = (typeof EVIDENCE_CADENCES)[number];

export const EVIDENCE_CADENCE_OPTIONS: { value: EvidenceCadence; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-annual (every 6 months)" },
  { value: "annual", label: "Annual" },
  { value: "every_2_years", label: "Every 2 years" },
  { value: "keep_current", label: "Custom / Keep current" },
];

export const EVIDENCE_CELL_STATUSES = ["done", "expiring", "missing"] as const;
export type EvidenceCellStatus = (typeof EVIDENCE_CELL_STATUSES)[number];

export const SERVICE_CODE_FLAGS = [
  "HHS",
  "SLN",
  "SLH",
  "SEI",
  "DSI",
  "RHS",
  "BC1",
  "BC2",
  "BC3",
] as const;
export type ServiceCodeFlag = (typeof SERVICE_CODE_FLAGS)[number];

export type DualLinkKind = "host_home_cert";

export type EvidenceRequirementDef = {
  key: string;
  title: string;
  shortLabel: string;
  evidenceType: EvidenceType;
  attestationText: string | null;
  cadence: EvidenceCadence;
  sowCite: string;
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
};

export type EvidencePackDef = {
  key: string;
  title: string;
  /** Short chip on suggested rows — All-staff, Transport, HHS, ABI, … */
  chip: string;
  subject: EvidenceSubject;
  description: string;
  requirementKeys: readonly string[];
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

export type EvidenceTemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  subject_type: EvidenceSubject;
  pack_keys: string[];
  requirement_keys: string[];
  created_at: string;
};

export type EvidencePerson = {
  id: string;
  full_name: string;
  initials: string;
  subtitle: string | null;
};

export type EvidenceGridColumn = {
  requirementKey: string;
  label: string;
  sowCite: string | null;
};

export type EvidenceGridCell = {
  subjectId: string;
  requirementKey: string;
  itemId: string | null;
  status: EvidenceCellStatus;
  expiresOn: string | null;
};

export const EVIDENCE_LIABILITY_TEXT =
  "I understand this pack is a suggestion based on common SOW topics. It is not comprehensive legal advice. My agency must verify requirements against our own contract / Scope of Work and add anything missing.";

export const EVIDENCE_DISCLAIMER =
  "Not called compliance. Suggestions only — provider picks packs and adds custom rows. Platform tracks upload + expiration (done / expiring / missing). No Home percent scoreboard.";

export const EVIDENCE_UNCHECK_WARNING =
  "This row was suggested from a common SOW topic. Unchecking it means you are opting out of that suggestion. Confirm your own contract still does not require it.";

export const EVIDENCE_PUSH_TITLE = "New evidence item";
export const EVIDENCE_PUSH_BODY =
  "Your agency assigned an evidence item. Open Evidence on your phone to upload or attest.";
export const EVIDENCE_PUSH_LINK = "/dashboard/my-evidence";
