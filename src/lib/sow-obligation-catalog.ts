// DHHS91172 SOW obligation catalog — the auditor's source of truth.
//
// Seeded `company_obligations` rows stay in the database (instances and
// completions key off those ids). This catalog overlays each SOW title with
// the fields a reviewer actually needs and that JSON cadence blobs cannot
// express accurately:
//   - where the work happens (in HIVE vs a state portal vs a standing file)
//   - the real due-date rule (period-following, hire-relative, cert expiration)
//   - who it applies to, and who owns it
//   - what evidence would satisfy a DSPD reviewer
//
// Titles must match the seeded rows exactly. Provider-created obligations
// (source = 'provider') have no catalog entry. Lookups also resolve title
// aliases and [Client Name] prefixes so renames still hit the stable key.

import { dueRuleFromConfig, explainDueRule, type DueRule } from "./obligation-due-dates.ts";
import {
  CATALOG_EXCEPTIONS_BY_KEY,
  CATALOG_IDENTITY_BY_TITLE,
  PACK_STATE_CODE,
  PACK_VERSION,
  SOFT_BACKFILL_TITLE_ALIASES,
  STANDING_RECLASSIFY_REASON,
  type CatalogExceptions,
  type CatalogFormTemplate,
  type ObligationDisposition,
} from "./sow-obligation-catalog-pack.ts";

export {
  CATALOG_EXCEPTIONS_BY_KEY,
  PACK_STATE_CODE,
  PACK_VERSION,
  SOFT_BACKFILL_TITLE_ALIASES,
  STANDING_RECLASSIFY_REASON,
  type CatalogExceptions,
  type CatalogFormField,
  type CatalogFormTemplate,
  type ObligationDisposition,
} from "./sow-obligation-catalog-pack.ts";

export type ObligationCategory =
  | "training"
  | "screening"
  | "licensing"
  | "reporting"
  | "safety"
  | "client_docs"
  | "standing_records"
  | "employment";

export type FulfillmentChannel = "in_hive" | "external" | "hybrid" | "standing";

export type ObligationOwner = "admin" | "manager" | "staff" | "host";

export type SowCatalogEntry = {
  title: string;
  key: string;
  state_code: "UT";
  disposition: ObligationDisposition;
  added_in: string;
  retired_in?: string;
  citation: string;
  category: ObligationCategory;
  fulfillment: FulfillmentChannel;
  /** What HIVE can and cannot do for this duty. Shown on the card. */
  fulfillment_note: string;
  due_rule: DueRule;
  owner: ObligationOwner;
  /** Empty = applies regardless of which service codes the org runs. */
  service_codes: string[];
  evidence_standard: string;
  /** Data-only evidence / form template. No form UI in Step 1. */
  evidence_template?: string;
  form_template?: CatalogFormTemplate;
  /**
   * When true, a reviewer should not treat a missed calendar instance as a
   * finding by itself — the duty is "keep current" and the instance is a
   * reminder to verify the file.
   */
  calendar_is_reminder_only?: boolean;
  /**
   * always (default) = every org in this jurisdiction, unless service_codes
   * exclude them. when_applicable = the SOW itself says "when applicable" or
   * the duty depends on an operational fact (OL-licensed site, volunteers,
   * governing board). The row stays visible until that fact is recorded.
   */
  applicability?: "always" | "when_applicable";
  applicability_note?: string;
  /** Live-path exceptions. Missing keys infer; never invent a second table. */
  exceptions?: CatalogExceptions;
};

export const CATEGORY_LABEL: Record<ObligationCategory, string> = {
  training: "Staff training",
  screening: "Screening & credentials",
  licensing: "Licenses & vendor status",
  reporting: "State reporting",
  safety: "Site safety",
  client_docs: "Person-specific documents",
  standing_records: "Standing records",
  employment: "Employment services",
};

export const FULFILLMENT_LABEL: Record<FulfillmentChannel, string> = {
  in_hive: "Tracked in HIVE",
  external: "Filed outside HIVE",
  hybrid: "HIVE + outside filing",
  standing: "Standing record",
};

export const OWNER_LABEL: Record<ObligationOwner, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Each assigned staff member",
  host: "Host home",
};

type SowCatalogDraft = Omit<
  SowCatalogEntry,
  "key" | "state_code" | "disposition" | "added_in" | "retired_in" | "evidence_template" | "form_template"
>;

const RAW_SOW_ENTRIES: SowCatalogDraft[] = [
  // ── Staff training ──────────────────────────────────────────────────────
  {
    title: "30-Day New Hire Orientation Training",
    citation: "DHHS91172 SOW §1.8(4)",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Staff open this from the staff file and complete the in-Hive 30-day course (SOW §1.8(4)(A)–(W) plus separately scored SAS essential topics, then a competency exam). Completing every topic and the exam greens the obligation and issues a checklist certificate. Paid agencies need a purchased 30-day or pack seat; True North Supports is always free. One-time hire requirement — annual hours are a separate obligation.",
    due_rule: { kind: "days_after_hire", days: 30 },
    owner: "staff",
    service_codes: [],
    evidence_standard:
      "Certificate covering HIPAA, ANE reporting, participant rights, HCBS settings rule, and emergency procedures.",
  },
  {
    title: "Annual 12-Hour Continuing Education",
    citation: "DHHS91172 SOW §1.9",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Upload CE certificates in HIVE, or log hours in the CE ledger. The in-platform 12-hour course is a Coming-soon placeholder and does not mark the card On file. Opening the placeholder uses the same 30-day / pack training seat as orientation; True North Supports is always free. Due on the hire anniversary starting the year after hire — not a calendar year.",
    due_rule: { kind: "hire_anniversary", start_year: 2 },
    owner: "staff",
    service_codes: [],
    evidence_standard:
      "Documentation of at least 12 DSPD-approved CE hours for the anniversary year.",
  },
  {
    title: "CPR/First Aid Certification — Initial",
    citation: "DHHS91172 SOW §1.8(5)",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Upload the CPR/First Aid card in HIVE. SOW allows 90 days from hire for the initial cert. Renewal is tracked separately off the printed expiration.",
    due_rule: { kind: "days_after_hire", days: 90 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Current CPR and First Aid certification.",
  },
  {
    title: "CPR/First Aid Certification — Renewal",
    citation: "DHHS91172 SOW §1.8(5)",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Upload the renewed card. NECTAR reads the printed expiration and schedules the next due date from that date — not from hire anniversary.",
    due_rule: { kind: "cert_expiration", fallback_months: 24 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Unexpired CPR and First Aid certification.",
  },
  {
    title: "Person-Centered Thinking and Practices Training",
    citation: "DHHS91172 SOW §1.8(5)(C)",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Hire-level in-platform course (Person-centered thinking in everyday support) plus upload. Passing the exam marks the card On file. Paid agencies need the same purchased 30-day or pack seat as orientation; True North Supports is always free. NCAPPS-informed Provider Interface education — not official NCAPPS. Separate from the per-client Person-Centered Thinking form.",
    due_rule: { kind: "days_after_hire", days: 90 },
    owner: "staff",
    service_codes: [],
    evidence_standard:
      "Proof of person-centered thinking and practices training within 90 days of hire.",
  },
  {
    title: "Behavior Intervention Certification (SOAR/MANDT/PART/CPI/Safety Care)",
    citation: "DHHS91172 SOW §1.8(6)",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Required for staff serving persons likely to engage in aggressive, self-injurious, or destructive behavior. Upload the cert; renewal follows the printed expiration.",
    due_rule: { kind: "cert_expiration", fallback_months: 24 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Current SOAR, MANDT, PART, CPI, Safety Care, or DSPD-approved equivalent.",
  },
  {
    title: "ACRE Training Certification — SEI",
    citation: "DHHS91172 SOW §30.5",
    category: "employment",
    fulfillment: "in_hive",
    fulfillment_note:
      "SEI staff must be ACRE-certified before providing services. Applies only to staff assigned to an SEI client. Upload the ACRE certificate.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: ["SEI"],
    evidence_standard: "ACRE certificate (USU or accredited ACRE program).",
  },
  {
    title: "ACRE Training Certification — SED",
    citation: "DHHS91172 SOW §28.4",
    category: "employment",
    fulfillment: "in_hive",
    fulfillment_note: "Applies only if the org serves SED. Upload the ACRE certificate.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: ["SED"],
    evidence_standard: "ACRE certificate.",
  },
  {
    title: "ACRE Training Certification — SJD (60 Days)",
    citation: "DHHS91172 SOW §33.5",
    category: "employment",
    fulfillment: "in_hive",
    fulfillment_note:
      "SJD staff have 60 days from hire. Applies only to staff assigned to an SJD client.",
    due_rule: { kind: "days_after_hire", days: 60 },
    owner: "staff",
    service_codes: ["SJD"],
    evidence_standard: "ACRE certificate including customized employment.",
  },
  {
    title: "Customized Employment Training (USU) — SEE/SJD",
    citation: "DHHS91172 SOW §29.4 / §33.5",
    category: "employment",
    fulfillment: "in_hive",
    fulfillment_note:
      "Required before providing SEE or SJD. Upload the USU Customized Employment certificate.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: ["SEE", "SJD"],
    evidence_standard: "USU Customized Employment training certificate.",
  },
  {
    title: "SEI — SSI/Benefits Knowledge Attestation",
    citation: "DHHS91172 SOW §30.5",
    category: "employment",
    fulfillment: "in_hive",
    fulfillment_note:
      "First-person attestation in HIVE. The knowledge itself is acquired outside HIVE (USOR / benefits training); HIVE records that the staff member attested before serving.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: ["SEI"],
    evidence_standard: "Staff attestation of basic SSI/Title II/Medicaid earned-income knowledge.",
  },
  {
    title: "HSQ — Clean, Sanitary & Safe Environment Training",
    citation: "DHHS91172 Article 12",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note: "Applies only to staff assigned to HSQ. Upload training record and attest.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: ["HSQ"],
    evidence_standard:
      "Training record on maintaining a clean, sanitary, and safe living environment.",
  },
  {
    title: "DSPD New Caregiver Compensation Training — CMP/CMS",
    citation: "DHHS91172 SOW §32.5",
    category: "training",
    fulfillment: "hybrid",
    fulfillment_note:
      "The course is taken on the DSPD site (80% passing score, effective 7/1/26). Upload the completion record in HIVE so the due date and assignee are tracked.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: ["CMP", "CMS"],
    evidence_standard: "DSPD New Caregiver Compensation training completion (score ≥ 80%).",
  },

  // ── Screening & credentials ─────────────────────────────────────────────
  {
    title: "Background Screening — Annual",
    citation: "DHHS91172 SOW §1.9(2)",
    category: "screening",
    fulfillment: "hybrid",
    fulfillment_note:
      "The screening itself is done through BCI / the state process. Upload the clearance in HIVE. Due on the hire anniversary; if a later cert prints an expiration, that date wins.",
    due_rule: { kind: "hire_anniversary", start_year: 1 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Current background screening clearance.",
  },
  {
    title: "Medicaid Fraud & Abuse Exclusion Screening — Annual",
    citation: "DHHS91172 SOW §1.9(7)",
    category: "screening",
    fulfillment: "hybrid",
    fulfillment_note:
      "Screen against OIG LEIE / Medicaid exclusion lists outside HIVE, then upload confirmation and attest. Annual from hire date.",
    due_rule: { kind: "hire_anniversary", start_year: 1 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "OIG/Medicaid exclusion screening with no exclusions found.",
  },
  {
    title: "Medicaid Disclosure Form — Annual",
    citation: "DHHS91172 SOW §1.9(6)",
    category: "screening",
    fulfillment: "hybrid",
    fulfillment_note:
      "The form lives on the DSPD webpage. Complete it, then upload the signed copy in HIVE. Due on each hire anniversary.",
    due_rule: { kind: "hire_anniversary", start_year: 1 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Signed DHHS Medicaid Disclosure Form.",
  },
  {
    title: "Educational Credentials and Licenses — On File",
    citation: "DHHS91172 SOW §1.9(4)",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "A standing personnel-file requirement, not a recurring training. Upload transcripts, licenses, or certifications once; the 30-day due date is the onboarding window.",
    due_rule: { kind: "days_after_hire", days: 30 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Copies of applicable transcripts, degrees, licenses, and certifications.",
  },
  {
    title: "Training Documentation File — Maintained",
    citation: "DHHS91172 SOW §1.9(3)",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Standing record: an external reviewer must be able to verify every required training. HIVE is the file. The generated annual date is a review reminder, not a SOW anniversary.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "A complete, reviewable training file per staff member.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Driving Record — On File (Transporting Staff)",
    citation: "DHHS91172 SOW §1.30",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Applies to staff who transport persons. Keep a current driving record, license, and auto insurance on file. Renewed annually from hire.",
    due_rule: { kind: "hire_anniversary", start_year: 1 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Current driving record, valid license, and current auto insurance.",
  },
  {
    title: "Child Placing / Foster Care License (DHHS/OL) — PPS",
    citation: "DHHS91172 SOW §20.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Issued by DHHS Office of Licensing. HIVE stores the uploaded license and tracks expiration; the license itself is obtained outside the platform.",
    due_rule: { kind: "cert_expiration", fallback_months: 12 },
    owner: "staff",
    service_codes: ["PPS"],
    evidence_standard: "Current DHHS/OL child-placing or foster-care license.",
  },

  // ── Licenses & vendor status (org) ──────────────────────────────────────
  {
    title: "OL Residential Support License — 4+ Persons per Site",
    citation: "DHHS91172 SOW §21.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Office of Licensing issues this. Upload the current license in HIVE. The July 1 date is an annual verification reminder — the real due date is the license expiration.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: ["RHS"],
    evidence_standard: "Current OL Residential Support License per qualifying RHS site.",
    calendar_is_reminder_only: true,
  },
  {
    title: "OL Residential Support Certification — 3 or Fewer Persons per Site",
    citation: "DHHS91172 SOW §21.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Office of Licensing issues this. Upload the current certification. July 1 is a verification reminder; track the printed expiration on the document.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: ["RHS"],
    evidence_standard: "Current OL Residential Support Certification per qualifying site.",
    calendar_is_reminder_only: true,
  },
  {
    title: "OL Day Treatment License — 4+ Persons",
    citation: "DHHS91172 SOW §8.5 / §7.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note: "Office of Licensing. Upload the license; July 1 is a verification reminder.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: ["DSG", "DSP", "EPR", "DSI"],
    evidence_standard: "Current OL Day Treatment License.",
    calendar_is_reminder_only: true,
  },
  {
    title: "OL Day Support Certification — 3 or Fewer Persons",
    citation: "DHHS91172 SOW §8.5 / §7.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Office of Licensing. Upload the certification; July 1 is a verification reminder.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: ["DSG", "DSP", "EPR", "DSI"],
    evidence_standard: "Current OL Day Support Certification.",
    calendar_is_reminder_only: true,
  },
  {
    title: "USOR Approved Vendor — Job Coaching (SEI)",
    citation: "DHHS91172 SOW §30.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "USOR vendor approval happens outside HIVE. Upload the approval letter and attest. This is a one-time (then keep-current) org qualification, not a staff training.",
    due_rule: { kind: "fixed_date", date: "2027-01-31" },
    owner: "admin",
    service_codes: ["SEI"],
    evidence_standard: "USOR approved-vendor letter for job coaching.",
  },
  {
    title: "USOR Approved Vendor — Job Development (SJD)",
    citation: "DHHS91172 SOW §33.5",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Proof is submitted to osrprovider@utah.gov. HIVE stores the upload and attestation; it cannot submit to USOR.",
    due_rule: { kind: "days_after_service_start", days: 180 },
    owner: "admin",
    service_codes: ["SJD"],
    evidence_standard: "USOR approved-vendor proof submitted to osrprovider@utah.gov.",
  },
  {
    title: "Zoning / Life Safety Code Compliance Documentation",
    citation: "DHHS91172 SOW §1.11",
    category: "licensing",
    fulfillment: "standing",
    fulfillment_note:
      "Keep current zoning, Life Safety Code, and fire/health documentation for licensed or certified sites. Upload in HIVE. July 1 is an annual verification reminder. SOW says 'when applicable' — this is an OL-site fact, not a service-code hide.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current zoning / Life Safety Code / fire-safety documentation.",
    calendar_is_reminder_only: true,
    applicability: "when_applicable",
    applicability_note:
      "Applies when the contractor operates an OL-licensed or OL-certified site. Not the same as awarded service codes. Until the org records that fact on the Company Profile, this row stays visible.",
  },

  // ── State reporting (external portals) ──────────────────────────────────
  {
    title: "HHS Annual Outcome Report — Google Form Submission",
    citation: "DHHS91172 SOW §11.7",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Submitted via the DSPD Google Form, not HIVE. Attest here after submitting. Due August 30 for the prior year.",
    due_rule: { kind: "calendar_year", month: 8, day: 30 },
    owner: "admin",
    service_codes: ["HHS"],
    evidence_standard:
      "DSPD Google Form submission (persons served, community-setting %, QI activities).",
  },
  {
    title: "SEI Monthly Summary — UPI Entry Attestation",
    citation: "DHHS91172 SOW §30.3",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "The summary is written in HIVE, but SEI monthly summaries must be typed into the state's UPI portal by the 15th of the following month. Staff never touch UPI — admin attests here after entry. HIVE cannot transmit to UPI.",
    due_rule: { kind: "calendar_month", due_day: 15, period: "following_month" },
    owner: "admin",
    service_codes: ["SEI"],
    evidence_standard: "UPI entry for every active SEI client for the service month.",
  },
  {
    title: "SEI Employment Data — UPI Entry Attestation",
    citation: "DHHS91172 SOW §30.3",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Employment data is maintained directly in UPI. HIVE only captures the admin attestation that UPI is current.",
    due_rule: { kind: "calendar_month", due_day: 15, period: "following_month" },
    owner: "admin",
    service_codes: ["SEI"],
    evidence_standard: "Current SEI employment data in UPI.",
  },
  {
    title: "SEI Employment Support Strategies — UPI Entry",
    citation: "DHHS91172 SOW §30.3",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Enter updated employment support strategies into UPI within 14 days of a PCSP update. Log the PCSP-update event here to start the clock — HIVE does not watch UPI.",
    due_rule: { kind: "days_after_event", days: 14 },
    owner: "admin",
    service_codes: ["SEI"],
    evidence_standard:
      "UPI entry of employment support strategies within 2 weeks of the PCSP update.",
  },
  {
    title: "SJD Monthly Summary — UPI Entry Attestation",
    citation: "DHHS91172 SOW §33.3",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Summary content can live in HIVE; UPI entry is outside HIVE by the 15th of the following month. Admin attests after entry.",
    due_rule: { kind: "calendar_month", due_day: 15, period: "following_month" },
    owner: "admin",
    service_codes: ["SJD"],
    evidence_standard: "UPI monthly summary for every active SJD client.",
  },
  {
    title: "SJD Employment Data — UPI Entry Attestation",
    citation: "DHHS91172 SOW §33.3",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note: "Maintained in UPI. HIVE captures the monthly attestation only.",
    due_rule: { kind: "calendar_month", due_day: 15, period: "following_month" },
    owner: "admin",
    service_codes: ["SJD"],
    evidence_standard: "Current SJD employment data in UPI.",
  },
  {
    title: "SJD Monthly USOR Contact Verification",
    citation: "DHHS91172 SOW §33.3",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Verify with each SJD client whether they received USOR outreach this month and record funding status. Attest in HIVE; the contact itself is outside the platform.",
    due_rule: { kind: "calendar_month", due_day: 15, period: "following_month" },
    owner: "admin",
    service_codes: ["SJD"],
    evidence_standard: "Documented USOR outreach status and funding status per SJD client.",
  },
  {
    title: "CMP/CMS Monthly Summaries — Submitted to SC",
    citation: "DHHS91172 SOW §32.3",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Monthly summaries for CMP/CMS are due to the Support Coordinator by the 15th of the following month. Write them in HIVE, then attest that they were sent. HIVE does not email the SC.",
    due_rule: { kind: "calendar_month", due_day: 15, period: "following_month" },
    owner: "admin",
    service_codes: ["CMP", "CMS"],
    evidence_standard:
      "Monthly summaries completed and submitted to each client's Support Coordinator.",
  },

  // ── Site safety ─────────────────────────────────────────────────────────
  {
    title: "HHS Quarterly Evacuation Drills — All Sites",
    citation: "DHHS91172 SOW §11.3",
    category: "safety",
    fulfillment: "in_hive",
    fulfillment_note:
      "Drills happen at the home. Upload the drill log in HIVE. Due by the last day of the quarter — not the first day of the next quarter. HIVE opens one instance per active HHS home.",
    due_rule: { kind: "calendar_quarter_end" },
    owner: "manager",
    service_codes: ["HHS"],
    evidence_standard: "Documented quarterly evacuation drill at each active HHS site.",
  },
  {
    title: "RHS Quarterly Evacuation Drills — All Sites",
    citation: "DHHS91172 SOW §21.3",
    category: "safety",
    fulfillment: "in_hive",
    fulfillment_note: "Upload the drill log. Due by the last day of the quarter.",
    due_rule: { kind: "calendar_quarter_end" },
    owner: "manager",
    service_codes: ["RHS"],
    evidence_standard: "Documented quarterly evacuation drill at each active RHS site.",
  },
  {
    title: "PPS Quarterly Evacuation Drills — All Sites",
    citation: "DHHS91172 SOW §20.3",
    category: "safety",
    fulfillment: "in_hive",
    fulfillment_note: "Upload the drill log. Due by the last day of the quarter.",
    due_rule: { kind: "calendar_quarter_end" },
    owner: "manager",
    service_codes: ["PPS"],
    evidence_standard: "Documented quarterly evacuation drill at each active PPS site.",
  },
  {
    title: "HHS Home Certification — Annual (DSPD Form)",
    citation: "DHHS91172 SOW §11.5",
    category: "safety",
    fulfillment: "hybrid",
    fulfillment_note:
      "Inspect each HHS home using the DSPD Host Home Certification form (outside HIVE), then upload the completed form. HIVE opens one instance per active HHS home — not a single agency packet.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: ["HHS"],
    evidence_standard: "Completed DSPD Host Home Certification form per HHS home.",
  },

  // ── Person-specific ─────────────────────────────────────────────────────
  {
    title: "Client-Specific Training — [Client Name]",
    citation: "DHHS91172 SOW §1.8(4)(O)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note:
      "One instance per staff+client assignment, due 30 days after assignment. Staff open this from the staff file and complete the existing client-specific form (attest). Not a scenario course.",
    due_rule: { kind: "days_after_assignment", days: 30 },
    owner: "staff",
    service_codes: [],
    evidence_standard:
      "Person-specific training covering disability/goals, medical/safety, PCSP/BSP/strategies, staff responsibilities, DNR/POLST and hospice if applicable.",
  },
  {
    title: "Support Strategies — [Client Name]",
    citation: "DHHS91172 SOW §1.24(5)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note:
      "Staff open this from the staff file and complete the existing support strategies form (attest) after it is published for that client. Due 30 days after the plan is activated.",
    due_rule: { kind: "days_after_event", days: 30 },
    owner: "manager",
    service_codes: [],
    evidence_standard: "Support Strategies submitted to the SC within 30 days of PCSP activation.",
  },
  // ── Standing duties (seeded on first register open + SQL handoff) ────────
  {
    title: "Emergency Management and Business Continuity Plan",
    citation: "CST 46",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Keep the plan on file. There is no SOW anniversary. Annual staff training on the plan is a separate duty.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current Emergency Management and Business Continuity Plan.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Annual Emergency Management Plan Training",
    citation: "CST 46",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Upload the training record. Due on each hire anniversary. Separate from the 30-day orientation.",
    due_rule: { kind: "hire_anniversary", start_year: 1 },
    owner: "staff",
    service_codes: [],
    evidence_standard:
      "Documented annual training on the Emergency Management and Business Continuity Plan.",
  },
  {
    title: "Staff Conflict of Interest Process",
    citation: "CST 9 & 10",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note: "A written process the auditor can read. Not a recurring calendar duty.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Written staff conflict-of-interest process.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Person Discharge Process",
    citation: "DHHS91172 SOW §1.22(c)",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Written discharge procedure. Triggered when a Person is discharged, not on a calendar.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Written Person-discharge procedure.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Internal Quality Management Plan",
    citation: "CST 50",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note: "Keep the IQMP on file. The auditor asks whether it is being followed.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Internal Quality Management Plan that can be externally validated.",
    calendar_is_reminder_only: true,
  },
  {
    title: "General, Professional, and Automobile Liability Insurance",
    citation: "CST 29–36",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Issued by the carrier. Upload declarations pages in HIVE. July 1 is a verification reminder — the real due date is the printed expiration.",
    due_rule: { kind: "calendar_year", month: 7, day: 1 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Current General, Professional, and Automobile liability insurance at contracted minimums.",
    calendar_is_reminder_only: true,
  },
  {
    title: "DHHS Code of Conduct — Signed",
    citation: "CST 76",
    category: "standing_records",
    fulfillment: "in_hive",
    fulfillment_note:
      "Applies to staff assigned to SLN, SLH, HHS, or PPS. Upload the signed copy. Due 30 days after hire.",
    due_rule: { kind: "days_after_hire", days: 30 },
    owner: "staff",
    service_codes: ["SLN", "SLH", "HHS", "PPS"],
    evidence_standard: "Signed DHHS Code of Conduct in the staff file.",
  },
  {
    title: "ABI Training — Before Working Alone",
    citation: "DHHS91172 SOW §1.8 (ABI training)",
    category: "training",
    fulfillment: "in_hive",
    fulfillment_note:
      "Required before working alone with a person with acquired brain injury. Assigned only to staff on an ABI caseload (or flagged requires_abi). Staff open this from the staff file and complete the in-Hive ABI course plus competency exam. Opening the course uses the same 30-day / pack training seat as orientation; True North Supports is always free.",
    due_rule: { kind: "days_after_hire", days: 0 },
    owner: "staff",
    service_codes: [],
    evidence_standard:
      "ABI training covering behavior effects, hospital-to-community transition, functional impact, health/medication, staff role, and family perspective.",
  },

  // ── Contractor-level Article 1 duties (encoded pack, 2026-08-22) ─────────
  {
    title: "DHHS Medicaid 101 Training — Contractor",
    citation: "DHHS91172 SOW §1.7(1)",
    category: "training",
    fulfillment: "hybrid",
    fulfillment_note:
      "This is the contractor-level Medicaid 101 — not the staff orientation topic in §1.8(4). Complete DHHS Medicaid 101 within 30 days of a fully executed contract and annually thereafter. Upload the completion record. Staff still receive the applicable portions in orientation.",
    due_rule: { kind: "calendar_year", month: 7, day: 31 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "DHHS Medicaid 101 completion for the current contract year (initial window is 30 days from contract execution; DHHS91172 year starts July 1).",
  },
  {
    title: "Utah Medicaid Provider Manuals — Annual Memo",
    citation: "DHHS91172 SOW §1.7(2)–(4)",
    category: "standing_records",
    fulfillment: "hybrid",
    fulfillment_note:
      "Read the Utah Medicaid provider manuals and rules (medicaid.utah.gov) within 90 days of contract execution and annually thereafter. File a memo certifying familiarity. The same annual review covers DSPD R539 and DHHS rules (§1.7(3)–(4)).",
    due_rule: { kind: "calendar_year", month: 9, day: 28 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Signed contractor memo that the Utah Medicaid provider manuals, Medicaid rules, DSPD R539, and applicable DHHS rules have been read and are on file.",
  },
  {
    title: "Volunteer Training File — When Volunteers Are Used",
    citation: "DHHS91172 SOW §1.6",
    category: "training",
    fulfillment: "standing",
    fulfillment_note:
      "Friends and natural supports the Person chooses are not volunteers. When the contractor uses regularly scheduled volunteers, they must meet staff qualifications, may not replace staff hours, and must complete the §1.6(3) topics before supporting Persons. Upload the training file. Overnight volunteer stays need written Person/guardian permission.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Written training records for each regularly scheduled volunteer covering Person-specific needs, ANE/rights, confidentiality, emergencies, the services they will provide, and applicable contractor policies.",
    calendar_is_reminder_only: true,
    applicability: "when_applicable",
    applicability_note:
      "Applies only when this contractor uses regularly scheduled volunteers. Natural supports the Person chooses are not volunteers.",
  },
  {
    title: "USTEPS and UPI Contractor Accounts",
    citation: "DHHS91172 SOW §1.4(2) / §1.15",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Keep a current USTEPS and UPI account, DSPD form 0-9 (company designee) and at least one form 0-8 (individual user). HIVE does not provision UPI. 1056 accept/reject within 15 days is a live authorization workflow, not this row.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Active USTEPS/UPI access plus current 0-9 company designee and 0-8 individual user forms.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Form 0-9 — Provider Company Designee Access",
    citation: "DHHS91172 SOW §1.15(1)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Complete DSPD form \"0-9 USTEPS Provider Interface (UPI) Provider Company Designee Access Form\". HIVE does not provision UPI. Staff never touch UPI. Record completion plus proof here.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation of the completed 0-9 company designee form plus screenshot or confirmation.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Form 0-8 — Individual User Access",
    citation: "DHHS91172 SOW §1.15(2)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Complete DSPD form \"0-8 USTEPS Provider Interface (UPI) Individual User Access Form\" for at least one Staff. HIVE does not provision UPI. Staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation of at least one completed 0-8 individual user form plus screenshot or confirmation.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Need-to-Know Access",
    citation: "DHHS91172 SOW §1.15(3)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Ensure that access to UPI is granted only to Staff that need to know the information in UPI to provide professional treatment or coordinate DSPD services. Which staff hold UPI access stays a recorded fact — never silent N/A.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation that current UPI users are limited to need-to-know staff, plus confirmation.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI 1056 Approve or Reject",
    citation: "DHHS91172 SOW §1.15(4)",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Approve or reject the DSPD Service Authorization Form 1056 (\"1056\") through UPI within 15 Calendar Days of the creation of a new or adjusted 1056. Record the UPI decision here. No authorization → no shift, no billing.",
    due_rule: { kind: "days_after_event", days: 15 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation of the UPI approve/reject decision plus screenshot or confirmation.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI 1056 Rejection — Support Coordinator Coordination",
    citation: "DHHS91172 SOW §1.15(5)",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "If the Contractor rejects the 1056, coordinate with the Person's Support Coordinator to either adjust the 1056, or start the process to discharge the Person from receiving Contractor's services and transition to a different contractor.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation of Support Coordinator coordination after a 1056 rejection, plus proof.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI 1056 Utilization Monitor",
    citation: "DHHS91172 SOW §1.15(6)",
    category: "reporting",
    fulfillment: "in_hive",
    fulfillment_note:
      "Monitor the use of services by the Person to ensure that the utilization of services complies with the approved 1056. If the Person is at risk of exhausting the units allocated in the 1056, notify the Person's Support Coordinator and arrange for appropriate changes to the Person's PCSP. Live authorization remaining-units check — not a second checklist.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Claim validation / remaining-units log when utilization approaches the 1056 allocation.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Provider Organization Structure",
    citation: "DHHS91172 SOW §1.15(7)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Use the UPI \"Provider Organization\" section to create and maintain a Contractor organizational group structure that will restrict UPI users from seeing Person information not required to provide professional treatment or coordinate DSPD services.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation of the current UPI Provider Organization group structure plus confirmation.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Staff Organizational Groups",
    citation: "DHHS91172 SOW §1.15(8)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Assign and maintain Staff with UPI access to the appropriate organizational groups. Admin-only — staff never touch UPI from this parent.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation that each UPI-access staff member is in the correct organizational group.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Staff Email and Notification Preference",
    citation: "DHHS91172 SOW §1.15(9)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Assign and maintain each Staff with UPI access, email, and notification preference. Admin-only — staff never touch UPI from this parent.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation of current UPI email and notification preference for each UPI-access staff member.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Person Organizational Groups",
    citation: "DHHS91172 SOW §1.15(10)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Assign and maintain each Person to the appropriate organizational groups in UPI. Record completion in the platform.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation that each Person is assigned to the appropriate UPI organizational groups.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Remove Terminated Staff — One Calendar Day",
    citation: "DHHS91172 SOW §1.15(11)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Remove terminated Staff from the \"Provider Organization\" within one Calendar Day of termination.",
    due_rule: { kind: "days_after_event", days: 1 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation that the terminated staff member was removed from the UPI Provider Organization within one Calendar Day.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Remove Staff Need-to-Know — One Calendar Day",
    citation: "DHHS91172 SOW §1.15(12)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Remove Staff from an organizational group within one Calendar Day of the Staff no longer needing to know the information in UPI to provide professional treatment or coordinate DSPD services.",
    due_rule: { kind: "days_after_event", days: 1 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation that the staff member was removed from the UPI organizational group within one Calendar Day of losing need-to-know.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Remove Discharged Person from Provider Organization",
    citation: "DHHS91172 SOW §1.15(13)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Remove a Person from the \"Provider Organization\" when the Contractor is no longer providing services to that Person, and has completed all business requiring the Person to remain in the \"Provider Organization\".",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator attestation that the discharged Person was removed from the UPI Provider Organization after remaining business was complete.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Annual Staff Access Review",
    citation: "DHHS91172 SOW §1.15(14)",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Conduct and document an annual review of all staff with UPI access to ensure all Staff with UPI access have the correct UPI access and the UPI Provider Organization is correct and current. Annual anchor is missing-information — do not invent employment-year, fiscal-year, or annual-from-completion.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Documented annual review that UPI access and the UPI Provider Organization are correct and current.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Notify DSPD USTEPS of UPI Staff Termination — One Calendar Day",
    citation: "DHHS91172 SOW §1.15(15)",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Notify the DSPD USTEPS team within one Calendar Day of the termination of Staff with UPI access. Staff never touch UPI from this parent.",
    due_rule: { kind: "days_after_event", days: 1 },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Logged notice to the DSPD USTEPS team within one Calendar Day of UPI-access staff termination.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Medicaid Provider Enrollment — Current",
    citation: "DHHS91172 SOW §1.4(1) / §1.13",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Stay enrolled as a Medicaid provider for the Community Support, Community Transition, and ABI waivers (DIH / DSPD Medicaid Enrollment Manager). Upload current enrollment proof. HIVE cannot enroll the contractor.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current Medicaid provider enrollment for the awarded waivers.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Medicaid Provider Change Notifications",
    citation: "DHHS91172 SOW §1.13(2)–(3)",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Notify dspdcontracts@utah.gov within 7 calendar days of phone/address/email changes. Notify the DSPD Contract Program Manager within 30 calendar days of ownership, legal name, or EIN changes. Log the notice here after it is sent. Also produce Medicaid provider documents within 7 days of a written DSPD request.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Written notice to DSPD on the contract timelines, or a standing file showing who to notify and that no unreported change is outstanding.",
    calendar_is_reminder_only: true,
  },
  {
    title: "No Gifts or Purchases-from-Staff Process",
    citation: "DHHS91172 SOW §1.28(9)–(10)",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "A written process the auditor can read: contractor and staff do not accept money from a Person and do not let a Person make purchases from the contractor or staff. Not a recurring calendar class.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Written process prohibiting acceptance of money and purchases from contractor/staff.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Governing or Policy-Making Board Records",
    citation: "DHHS91172 SOW §1.14",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "If the contractor has a governing or policy-making board: keep by-laws, meet at least quarterly, and keep minutes with membership and attendance. Skip this row only after recording that the org has no such board.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "By-laws plus quarterly board minutes with membership and attendance.",
    calendar_is_reminder_only: true,
    applicability: "when_applicable",
    applicability_note:
      "Applies only if the contractor is governed by a governing or policy-making board.",
  },
  {
    title: "Personnel Policies and Job Descriptions",
    citation: "DHHS91172 SOW §1.17",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Written personnel policies and a job description for each staff position (duties, responsibilities, minimum qualifications). Upload the current set. Not a per-period class.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Current personnel policies and written job descriptions for every staff position.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Operating Policies and Procedures",
    citation: "DHHS91172 SOW §1.18",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Written operating policies covering staff/supervisory responsibilities, transportation (if provided), staff and Person grievances, and emergency procedures for injury, illness, mental-health decline, or death. Upload the current set.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current operating policies covering the elements in SOW §1.18.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Human Rights Plan",
    citation: "DHHS91172 SOW §1.21",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "A written Human Rights Plan (HCBS Settings Rule) — separate from the live HRC roster and restriction records. N/A only if the contractor provides solely CHA, HSQ, or PBA.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Human Rights Plan covering rights training, ANE prevention, modification process, high-risk review, and the HRC.",
    calendar_is_reminder_only: true,
    applicability: "when_applicable",
    applicability_note:
      "Required unless the contractor only provides CHA, HSQ, or PBA. TNS (HHS/SLH/SLN/SEI/DSI) must keep this on file.",
  },
  {
    title: "Health Support Policies and Procedures",
    citation: "DHHS91172 SOW §1.23",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Written health-support policies for Persons' medical needs. Day-to-day medical, dental, and medication records are live Person artifacts — this row is the contractor policy file.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current health support policies and procedures.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Housemate Informed-Choice Discussion",
    citation: "DHHS91172 SOW §1.35",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note:
      "For HHS, PPS, or RHS: document an informed discussion about who the Person lives with and household accommodations. Required at placement and any housemate change on or after July 1, 2026.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "PPS", "RHS"],
    evidence_standard:
      "Written informed-choice discussion notes for each residential Person, updated when a housemate changes.",
    calendar_is_reminder_only: true,
    applicability: "when_applicable",
    applicability_note:
      "Triggered at placement and whenever a housemate changes on or after July 1, 2026.",
  },
  {
    title: "DSI Annual Outcome Report — Google Form Submission",
    citation: "DHHS91172 SOW §8.6",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Fiscal-year Day Supports outcome report via the DSPD Google Form by August 30. Attest here after submitting. HIVE cannot transmit the form.",
    due_rule: { kind: "calendar_year", month: 8, day: 30 },
    owner: "admin",
    service_codes: ["DSI"],
    evidence_standard:
      "DSPD Google Form submission (persons served, social-opportunity / skill / satisfaction measures, QI activities).",
  },
  {
    title: "SEI Annual Outcome Report — Google Form Submission",
    citation: "DHHS91172 SOW §30.7",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "Fiscal-year SEI outcome report via the DSPD Google Form by August 30. Separate from the monthly UPI summary attestation.",
    due_rule: { kind: "calendar_year", month: 8, day: 30 },
    owner: "admin",
    service_codes: ["SEI"],
    evidence_standard:
      "DSPD Google Form submission (persons served, CIE count, wages, weekly hours, SEI support hours, QI activities).",
  },
  {
    title: "Supported Living Annual Outcome Report — Google Form Submission",
    citation: "DHHS91172 SOW §31.5 / §32.7",
    category: "reporting",
    fulfillment: "external",
    fulfillment_note:
      "One fiscal-year Supported Living outcome report (SLH and/or SLN) via the DSPD Google Form by August 30. Attest here after submitting.",
    due_rule: { kind: "calendar_year", month: 8, day: 30 },
    owner: "admin",
    service_codes: ["SLH", "SLN"],
    evidence_standard:
      "DSPD Google Form submission (persons served, community-setting stability %, QI activities).",
  },
  {
    title: "Utah Department of Commerce — Entity Standing",
    citation: "Practice Audit — agency standing",
    category: "licensing",
    fulfillment: "external",
    fulfillment_note:
      "Issued by the Utah Department of Commerce. Upload current entity-standing proof. There is no SOW anniversary.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current Utah Department of Commerce entity standing.",
    calendar_is_reminder_only: true,
  },
  {
    title: "DHHS Code of Conduct — Posted",
    citation: "CST 76",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Site posting of the DHHS Code of Conduct. Separate from the signed staff copy on the staff file.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Photo or attestation that the current DHHS Code of Conduct is posted.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Business Associate Agreements — On File",
    citation: "HIPAA — BAA",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Vendor BAAs for PHI. This is not the Provider Interface signup BAA.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current BAAs for vendors that handle PHI.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Large-Loan Disclosure Process",
    citation: "DHHS91172 SOW §1.28(7)(G)",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Written disclosure process for contractor-to-Person loans of $2,000 or more. Live loan records stay in Client loans.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Written large-loan disclosure process.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Incident Reporting Process",
    citation: "DHHS91172 SOW §1.27",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note:
      "Written incident reporting process. Live incident records stay in Incidents.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Written incident reporting process.",
    calendar_is_reminder_only: true,
  },
  {
    title: "HIPAA Notice of Privacy Practices",
    citation: "HIPAA — NPP",
    category: "standing_records",
    fulfillment: "standing",
    fulfillment_note: "Keep the current Notice of Privacy Practices on file.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Current HIPAA Notice of Privacy Practices.",
    calendar_is_reminder_only: true,
  },

  // Soft-retired per-client PCT (#299). Keep the catalog path + key so
  // backfill and title aliases still resolve. Hire-level PCT stays live.
  {
    title: "Person-Centered Thinking — [Client Name]",
    citation: "DHHS91172 SOW §1.8(5)(C)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note:
      "Retired. Person-centered thinking is hire-level staff training once (Person-Centered Thinking and Practices Training). Do not assign a per-client form.",
    due_rule: { kind: "days_after_assignment", days: 30 },
    owner: "staff",
    service_codes: [],
    evidence_standard: "Retired — use the hire-level Person-Centered Thinking and Practices course.",
  },

  // ── Review-tool / intake / by_design (data only; no new form UIs) ────────
  {
    title: "Human Rights Committee — Established and Meeting",
    citation: "DHHS91172 SOW §1.21(5)",
    category: "standing_records",
    fulfillment: "in_hive",
    fulfillment_note: "Live HRC roster, meetings, and attendance. Not a second calendar to-do.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "HRC roster, meeting records, and attendance in HIVE.",
    calendar_is_reminder_only: true,
  },
  {
    title: "EPR Community Time — 20 Percent Process",
    citation: "DHHS91172 SOW §9.3",
    category: "reporting",
    fulfillment: "in_hive",
    fulfillment_note: "Live EPR community-time tracking. Not a cloned register duty.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["EPR"],
    evidence_standard: "Process and records showing Persons are in the community 20% of the time.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Medical and Dental Examinations — Person File",
    citation: "DHHS91172 SOW §1.23(h)(1)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Collected into the Person file at intake and kept current.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["RHS", "PPS", "HHS", "SLH", "RP4", "RP5"],
    evidence_standard: "Record of medical and/or dental examinations in the Person file.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Medication Record — When Contractor Supports Meds",
    citation: "DHHS91172 SOW §1.23(b–c)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "eMAR is the electronic record. N/A when this contractor does not support meds.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard: "Paper or electronic record of all medications taken.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Functional Behavior Assessment and Behavior Support Plan",
    citation: "DHHS91172 SOW Articles 3–5",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Live behavior-support module. Not a second to-do.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["BC1", "BC2", "BC3"],
    evidence_standard: "FBA and BSP on file for Persons receiving BC1, BC2, or BC3.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Grievance Policy Acknowledgment — Signed",
    citation: "DHHS91172 SOW §1.10(11)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Per-Person signed acknowledgment at intake. Not an org poster.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard: "Signed statement that the Person (and representative) received and had the grievance policy explained.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Human-Rights Restriction Record",
    citation: "DHHS91172 SOW §1.20",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Live HRC restriction records (elements a–h). N/A when there is no modification.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard: "Informed consent, assessed need, positive supports tried, less-intrusive methods, proportionate description, data review, time limits, and no-harm assurance.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Belongings Inventory — Annual",
    citation: "DHHS91172 SOW §11.3(5) / §31.3",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Live belongings register. Applies to HHS, SLH, PPS, and RHS — not SLN.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "SLH", "PPS", "RHS"],
    evidence_standard: "Inventory of belongings $50+ and items of significant value, reviewed at least annually.",
    calendar_is_reminder_only: true,
  },
  {
    title: "HHS Room-and-Board Agreement",
    citation: "DHHS91172 SOW §11.3(9)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Signed agreement in the Person file at placement.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS"],
    evidence_standard: "Current room-and-board agreement meeting contract and HCBS Settings Rule standards.",
    calendar_is_reminder_only: true,
  },
  {
    title: "RHS Lease Agreement",
    citation: "DHHS91172 SOW §21.3(1)",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Signed lease in the Person file at placement.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["RHS"],
    evidence_standard: "Lease agreement meeting contract and HCBS Settings Rule standards.",
    calendar_is_reminder_only: true,
  },
  {
    title: "PPS Room-and-Board Agreement",
    citation: "DHHS91172 SOW §20.3",
    category: "client_docs",
    fulfillment: "in_hive",
    fulfillment_note: "Signed agreement in the Person file at placement.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["PPS"],
    evidence_standard: "Room-and-board agreement meeting contract and HCBS Settings Rule standards.",
    calendar_is_reminder_only: true,
  },
  {
    title: "PBA / Representative-Payee Financial Review",
    citation: "DHHS91172 SOW §1.28 / §15.3",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note: "Live PBA / representative-payee records. Not a cloned calendar class.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["PBA"],
    evidence_standard: "Monthly records with the Person, bank statements, independent review, quarterly admin sample, monthly report to the SC.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Emergency Loan Documentation",
    citation: "DHHS91172 SOW §1.28(7)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note: "Live client-loans module. N/A when there are no loans.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "SC notice within 24 hours, PCPT approval, running accounting, monthly copy to Person/guardian/SC.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Attendance / Timesheets — Accurate Record",
    citation: "DHHS91172 SOW §1.10(7); CST 55 & 56",
    category: "reporting",
    fulfillment: "in_hive",
    fulfillment_note: "HIVE time entries are the attendance record. Not a second to-do.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Person, date, service code, staff, summary note; start/end time for quarter-hour codes.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Electronic Visit Verification",
    citation: "DHHS91172 SOW §1.12",
    category: "reporting",
    fulfillment: "in_hive",
    fulfillment_note: "Live EVV / geofence validation. Not a cloned register duty.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "EVV for Companion, Homemaker, Respite (except RP4/RP5/RPS), Supported Living, and Personal Assistance.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Billed Services Match Service-Code Description",
    citation: "DHHS91172 SOW Articles 3–33",
    category: "reporting",
    fulfillment: "in_hive",
    fulfillment_note: "Nectar flags mismatches; a human attests before a claim goes out.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Billed units match the service-code description in Articles 3–33.",
    calendar_is_reminder_only: true,
  },
  {
    title: "HHS Billable Day — Present plus Daily Note",
    citation: "DHHS91172 SOW Article 11",
    category: "reporting",
    fulfillment: "in_hive",
    fulfillment_note: "Live hhs_daily_records_v. Present + daily note. No overnight stay = unbillable.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["HHS"],
    evidence_standard: "Each billed Host Home day is attendance Present with a daily note.",
    calendar_is_reminder_only: true,
  },
  {
    title: "PM1/PM2 Nursing File — Medication Program Leftovers",
    citation: "DHHS91172 SOW §16.2 / §16.4 / §17.2 / §17.4",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing PM1/PM2 nursing leftover file. Official catalog clauses only. Does not replace MAR/eMAR. medication_record stays the Article 1 med file.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["PM1", "PM2"],
    evidence_standard:
      "Medical data sheet, medication-error review, 24-hour illness notice, face-to-face assessment, and current LPN/RN DOPL license.",
    calendar_is_reminder_only: true,
  },
  {
    title: "PN1/PN2 Medical Care Plan — Nursing Leftovers",
    citation: "DHHS91172 SOW §18.2 / §18.5 / §19.2 / §19.5",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing PN medical-care-plan leftover file. REQ-19.2.10 stays a child on this card. Do not invent a PN1/PN2 monthly-summary key. Staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["PN1", "PN2"],
    evidence_standard:
      "Current Medical Care Plan, PN1 reports to PN2, delegated-staff training, urgent-risk notes, and DOPL licenses.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SJD Discovery / Vocational Assessment Leftovers",
    citation: "DHHS91172 SOW §33.2",
    category: "employment",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing SJD discovery / vocational leftover file. Official catalog clauses only. Staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["SJD"],
    evidence_standard:
      "Discovery-or-vocational choice, transportation assessment, discovery assessment, vocational Employment Plan, benefits analysis, weekly progress notes, and 30-day job-retention support.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Household 12+ Background Screening Leftovers",
    citation: "DHHS91172 SOW §11.3 / §20.3 / §22.3 / §23.3 / §24.3 / §25.3",
    category: "screening",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing household 12+ background leftover file for HHS, PPS, and staff-residence respite. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "PPS", "RP2", "RP3", "RP4", "RP5"],
    evidence_standard:
      "Background screening for individuals 12 or older who resided in the home for any cumulative 30 days of the past 12 months.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Medicaid Eligibility Review Assistance Leftovers",
    citation: "DHHS91172 SOW §11.2 / §20.2 / §21.2 / §31.2",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing Medicaid eligibility-review assistance leftover file for HHS, PPS, RHS, and SLH. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "PPS", "RHS", "SLH"],
    evidence_standard:
      "Assistance completing Medicaid eligibility review documents and timely submission.",
    calendar_is_reminder_only: true,
  },
  {
    title: "DHHS Quality Remediation Plan Leftovers",
    citation: "DHHS91172 SOW §1.19",
    category: "standing_records",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing DHHS quality-management Remediation Plan leftover file. Official catalog clauses only. Contractor-wide — not an awarded-code clock.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Written Remediation Plan for each DHHS deficiency, submitted in the required timeframe, with a seven-day revision if rejected.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Day-to-Day Program Staff Leftovers",
    citation: "DHHS91172 SOW §7.3 / §9.3 / §10.3 / §21.3",
    category: "standing_records",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing day-to-day program-staff leftover file for DSG/DSP, EPR, ELS, and RHS sites. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["DSG", "DSP", "EPR", "ELS", "RHS"],
    evidence_standard:
      "Named staff responsible for day-to-day operations at each awarded program site.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SED/SEE/SEI Assessment and Fade Leftovers",
    citation: "DHHS91172 SOW §28.2 / §29.2 / §30.2",
    category: "employment",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing SED/SEE assessment and SED/SEI fade leftover file. Official catalog clauses only. Staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["SED", "SEE", "SEI"],
    evidence_standard:
      "SED/SEE skill and barrier assessments plus written fade plans that increase on-the-job independence.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SJP/SJR Milestone Request for Services Leftovers",
    citation: "DHHS91172 SOW §34.3 / §35.3",
    category: "employment",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing SJP/SJR milestone RFS leftover file. Official catalog clauses only. REQ-34.5 / REQ-35.5 stay invent-blocked contractor-qualification umbrellas. Staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["SJP", "SJR"],
    evidence_standard:
      "Written Support Coordinator request to complete an RFS for the SJP or SJR milestone payment, with the required documentation packet.",
    calendar_is_reminder_only: true,
  },
  {
    title: "EPR Program File Leftovers",
    citation: "DHHS91172 SOW §9.2 / §9.5",
    category: "employment",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing EPR leftover file: Informed Choice, 511 Career Counseling, pre-vocational staff training, and supervisory ACRE / Workplace Supports / Effective Job Coach. Do not reuse acre_sei / acre_sed / acre_sjd. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["EPR"],
    evidence_standard:
      "60-day Informed Choice conversation, annual 511 coordination with USOR, pre-vocational staff training, and EPR supervisory training proof.",
    calendar_is_reminder_only: true,
  },
  {
    title: "BC Staff Qualifications Leftovers",
    citation: "DHHS91172 SOW §3.6 / §4.6 / §5.6",
    category: "training",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing BC1/BC2/BC3 staff-qualification leftover file. Official catalog clauses only. Rights-modification twins stay unwired.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["BC1", "BC2", "BC3"],
    evidence_standard:
      "BC1 Option A or B, BC2 Option A–D, and BC3 Option A–D qualification files.",
    calendar_is_reminder_only: true,
  },
  {
    title: "RHS Housing Voucher Leftovers",
    citation: "DHHS91172 SOW §21.3(8)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing RHS housing-voucher leftover file. Official catalog clauses only. The Contractor or Support Coordinator may not request voucher termination.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["RHS"],
    evidence_standard:
      "PCPT voucher review at approval and annually, Public Housing Authority move coordination, and written Person/guardian termination request.",
    calendar_is_reminder_only: true,
  },
  {
    title: "DNR Order Access Leftovers",
    citation: "DHHS91172 SOW §1.10(14)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing DNR-access leftover file. Official catalog clauses only. FACT-068 stays a question when unanswered.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard:
      "DNR order accessible to staff in the Person's service settings, with the Person's preferred location recorded.",
    calendar_is_reminder_only: true,
  },
  {
    title: "PCSP Orientation and PCPT Review Leftovers",
    citation: "DHHS91172 SOW §1.24(7) / §1.24(9)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing PCSP orientation / PCPT review leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard:
      "Orientation to the contractor portion of the PCSP and an annual PCPT review within 12 months of the last PCSP meeting.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Fatality Notification Leftovers",
    citation: "DHHS91172 SOW §1.26",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing fatality-notification leftover file. Official catalog clauses only. Punch pad stays the incident clock.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard:
      "Family notice within 24 hours and Support Coordinator plus DSPD Waiver Manager notice by the end of the next calendar day.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Support Coordinator Records-on-Request Leftovers",
    citation: "DHHS91172 SOW §1.31(2) / §1.31(3)",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing Support Coordinator records-on-request leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Licensing/site-certification copies on request and timesheet copies within three calendar days of request.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Residential Group-Mix Approval Leftovers",
    citation: "DHHS91172 SOW §1.32(b)",
    category: "safety",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing HHS/RHS group-mix approval leftover file. Official catalog clauses only. Grandfather REQ-1.32.a and OL-portal REQ-1.32.c stay invent-blocked.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "RHS"],
    evidence_standard:
      "Written pre-placement approval when certified HHS or RHS settings mix adults with minors or DSPD-funded Persons with non-DSPD-funded individuals.",
    calendar_is_reminder_only: true,
  },
  {
    title: "USDC Transition Coordination Leftovers",
    citation: "DHHS91172 SOW §1.36",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing USDC transition leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard:
      "Coordination with the DHHS/DSPD Transition team for USDC admissions and discharges, including time with new staff when requested.",
    calendar_is_reminder_only: true,
  },
  {
    title: "ELS School-Age Temporary Use Leftovers",
    citation: "DHHS91172 SOW §10.3(3)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing ELS school-age leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["ELS"],
    evidence_standard:
      "School-age ELS used only temporarily, or school-district shortened-hours documentation including the IEP.",
    calendar_is_reminder_only: true,
  },
  {
    title: "HHS/PPS Host Contractor-Change Leftovers",
    citation: "DHHS91172 SOW §11.3(8) / §20.3(8)",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing HHS/PPS host contractor-change leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "PPS"],
    evidence_standard:
      "Both contractors notify the Support Coordinator before an HHS or PPS host changes contractor, and neither influences Informed Choice.",
    calendar_is_reminder_only: true,
  },
  {
    title: "HHS/PPS Host Staff Age Leftovers",
    citation: "DHHS91172 SOW §11.6 / §20.6",
    category: "training",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing HHS/PPS host and PPS staff age leftover file. Official catalog clauses only. Hosts never clock.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "PPS"],
    evidence_standard: "HHS hosts and PPS staff are at least 21 years of age.",
    calendar_is_reminder_only: true,
  },
  {
    title: "PBA Monthly Fiduciary Leftovers",
    citation: "DHHS91172 SOW §15.2(6) / §15.2(10)",
    category: "reporting",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing PBA monthly fiduciary leftover file. Official catalog clauses only. Separate from the 15.3 administrative review card.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["PBA"],
    evidence_standard:
      "Monthly asset-limit monitoring with notice when approaching limits, plus a monthly financial-record review with the Person.",
    calendar_is_reminder_only: true,
  },
  {
    title: "RHS Form 930 Enhanced Staffing Leftovers",
    citation: "DHHS91172 SOW §21.3(4)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing RHS Form 930 leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["RHS"],
    evidence_standard:
      "Completed DSPD Form 930 before RHS enhanced staffing of four or more hours per day at a 1:1 Direct Support ratio.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Form 929 Exceptional-Care Respite Leftovers",
    citation: "DHHS91172 SOW §23.3(1) / §25.3(1)",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing DSPD Form 929 leftover file. Official catalog clauses only.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["RP3", "RP5"],
    evidence_standard: "Completed DSPD Form 929 before RP3 or RP5 exceptional-care respite begins.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SEC Pass-Through and Co-Worker Support Leftovers",
    citation: "DHHS91172 SOW §27.3",
    category: "employment",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing SEC pass-through leftover file. Official catalog clauses only. Staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["SEC"],
    evidence_standard:
      "Documentation of pass-through funds and co-worker supports the Person received.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SEE Staff Training Leftovers",
    citation: "DHHS91172 SOW §29.4",
    category: "training",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing SEE staff-training leftover file. Official catalog clauses only. Do not reuse acre_sei / acre_sed / acre_sjd.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["SEE"],
    evidence_standard:
      "SEE staff pre-service completions plus first-available USU Workplace Supports or Effective Job Coach training.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SEI Job-Termination Notice Leftovers",
    citation: "DHHS91172 SOW §30.3(3)",
    category: "employment",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing SEI job-termination leftover file. Official catalog clauses only. Notify USOR — staff never touch UPI.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["SEI"],
    evidence_standard:
      "USOR notice within one business day of job termination and a review that modifies the PCSP and employment goals.",
    calendar_is_reminder_only: true,
  },
  {
    title: "TFB Staff Qualifications Leftovers",
    citation: "DHHS91172 SOW §36.4",
    category: "training",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing TFB staff-qualification leftover file. Official catalog clauses only. Do not invent a CST parent.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["TFB"],
    evidence_standard:
      "Bachelor's degree in social or behavioral sciences plus one year in the past five of training people with ID.RC and/or ABI and their families.",
    calendar_is_reminder_only: true,
  },
  {
    title: "OL Capacity Comply Leftovers",
    citation: "DHHS91172 SOW §7.3(5) / §8.3(3) / §9.3(5) / §22.3(3) / §23.3(4) / §24.3(3) / §25.3(4) / §26.3(2)",
    category: "licensing",
    fulfillment: "standing",
    fulfillment_note:
      "Standing OL-capacity comply card. Official catalog clauses only. Not a calendar and not an ol_* license-file attachment.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["DSG", "DSP", "DSI", "EPR", "RP2", "RP3", "RP4", "RP5", "RPS"],
    evidence_standard:
      "Site-based facility stays within the capacity allowed under its OL license or certification.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Employee Registry Leftovers",
    citation: "DHHS91172 SOW §30.8(1) / §33.7(1)",
    category: "employment",
    fulfillment: "standing",
    fulfillment_note:
      "Administrator-only UPI employee-registry leftover. Staff never touch UPI. Never a DSP My Tasks card. Do not reuse Provider Interface or SEI employment-data keys.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["SEI", "SJD"],
    evidence_standard:
      "Administrator attestation that each staff unique identifier is set up in the UPI employee registry.",
    calendar_is_reminder_only: true,
  },
  {
    title: "UPI Employee Timesheet Leftovers",
    citation: "DHHS91172 SOW §30.8(2) / §33.7(2)",
    category: "employment",
    fulfillment: "standing",
    fulfillment_note:
      "Administrator-only UPI pay-period timesheet leftover. Staff never touch UPI. Never a DSP My Tasks card. Punch pad stays the clock. EVV stays CSV only.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["SEI", "SJD"],
    evidence_standard:
      "Administrator attestation that pay-period staff timesheets were submitted as individual UPI payments.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Agency License Register Leftovers",
    citation: "DHHS91172 SOW §1.4(3) / §1.34",
    category: "licensing",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing agency license register. Official catalog clauses only. Do not reuse per-article ol_* service keys.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Current licenses and certificates required by individual service-code descriptions, R501, and Utah Code §58-1.",
    calendar_is_reminder_only: true,
  },
  {
    title: "ELS Residential Eligibility Leftovers",
    citation: "DHHS91172 SOW §10.5",
    category: "licensing",
    fulfillment: "standing",
    fulfillment_note:
      "Eligibility gate: awarded ELS plus at least one of RHS, PPS, or HHS. Official catalog clauses only. Do not attach to els_school_age.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["ELS"],
    evidence_standard: "Awarded ELS plus at least one of RHS, PPS, or HHS.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Home Condition Checklist Leftovers",
    citation: "DHHS91172 SOW §11.3(2) / §20.3(2) / §21.3(2)",
    category: "safety",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing HHS/PPS/RHS home-condition checklist. Official catalog clauses only. Children (A)–(G) stay on the parent. Do not invent umbrella REQ-11.3 / REQ-20.3 / REQ-21.3.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: ["HHS", "PPS", "RHS"],
    evidence_standard:
      "Home is integrated, accessible, autonomy-supporting, private, free from coercion, and selected after residential options are offered.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SEC Requires SEI Leftovers",
    citation: "DHHS91172 SOW §27.5",
    category: "employment",
    fulfillment: "standing",
    fulfillment_note:
      "Eligibility gate: awarded SEC plus awarded SEI. Official catalog clauses only. Do not attach to milestone_rfs or sec_pass_documentation.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["SEC"],
    evidence_standard: "Awarded SEC plus awarded SEI.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SJP Requires SJD Leftovers",
    citation: "DHHS91172 SOW §34.5",
    category: "employment",
    fulfillment: "standing",
    fulfillment_note:
      "Eligibility gate: awarded SJP plus a current DHHS91172 SJD contract. Official catalog clauses only. Do not attach to milestone_rfs.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["SJP"],
    evidence_standard: "Awarded SJP plus a current DHHS91172 SJD contract.",
    calendar_is_reminder_only: true,
  },
  {
    title: "SJR Requires SEE or SEI Leftovers",
    citation: "DHHS91172 SOW §35.5",
    category: "employment",
    fulfillment: "standing",
    fulfillment_note:
      "Eligibility gate: awarded SJR plus a current DHHS91172 SEE or SEI contract. Official catalog clauses only. Do not attach to milestone_rfs.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: ["SJR"],
    evidence_standard: "Awarded SJR plus a current DHHS91172 SEE or SEI contract.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Historical Group Service Review Leftovers",
    citation: "DHHS91172 SOW §1.32(a)",
    category: "licensing",
    fulfillment: "hybrid",
    fulfillment_note:
      "Historical Group Service Review leftover for the existing-contractor cohort. Official catalog clauses only. Do not reuse residential_group_mix.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard: "Submitted Group Service Review form for the existing-contractor cohort.",
    calendar_is_reminder_only: true,
  },
  {
    title: "DLBC Group Variance Leftovers",
    citation: "DHHS91172 SOW §1.32(c)",
    category: "licensing",
    fulfillment: "hybrid",
    fulfillment_note:
      "DLBC portal variance leftover when group services are delivered at an OL-licensed site. Event-triggered. Official catalog clauses only. Do not reuse residential_group_mix.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard:
      "DLBC provider-portal variance approval before group services at an OL-licensed site.",
    calendar_is_reminder_only: true,
  },
  {
    title: "As-Offered Medicaid Provider Training Leftovers",
    citation: "DHHS91172 SOW §1.13(4)",
    category: "training",
    fulfillment: "standing",
    fulfillment_note:
      "As-offered DIH/DSPD Medicaid Provider training leftover. Admin-supplied offered date. Official catalog clauses only. Do not invent a calendar interval.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Administrator record of participation when DIH or DSPD offered the training.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Person Record File Leftovers",
    citation: "DHHS91172 SOW §1.10",
    category: "client_docs",
    fulfillment: "hybrid",
    fulfillment_note:
      "Standing person-record parent file. Official catalog clauses only. Already-wired 1.10 children stay on their own cards.",
    due_rule: { kind: "standing" },
    owner: "manager",
    service_codes: [],
    evidence_standard:
      "Separate Person record updated at least annually and on material change.",
    calendar_is_reminder_only: true,
  },
  {
    title: "Staff Minimum Age System Check Leftovers",
    citation: "DHHS91172 SOW §1.5",
    category: "screening",
    fulfillment: "standing",
    fulfillment_note:
      "System-check from staff date of birth. Official catalog clauses only. Do not reuse host_staff_qualifications. Do not invent a training upload card.",
    due_rule: { kind: "standing" },
    owner: "admin",
    service_codes: [],
    evidence_standard:
      "Staff date of birth shows age 16 or older unless a listed exception applies.",
    calendar_is_reminder_only: true,
  },
];

function finalizeCatalogEntry(raw: SowCatalogDraft): SowCatalogEntry {
  const meta = CATALOG_IDENTITY_BY_TITLE[raw.title];
  if (!meta) {
    throw new Error(`Missing catalog key/disposition for "${raw.title}"`);
  }
  const exceptions = CATALOG_EXCEPTIONS_BY_KEY[meta.key];
  return {
    ...raw,
    key: meta.key,
    state_code: PACK_STATE_CODE,
    disposition: meta.disposition,
    added_in: PACK_VERSION,
    ...(meta.retired_in ? { retired_in: meta.retired_in } : {}),
    ...(meta.evidence_template ? { evidence_template: meta.evidence_template } : {}),
    ...(meta.form_template ? { form_template: meta.form_template } : {}),
    ...(exceptions ? { exceptions } : {}),
  };
}

const SOW_ENTRIES: SowCatalogEntry[] = RAW_SOW_ENTRIES.map(finalizeCatalogEntry);

const BY_TITLE = new Map(SOW_ENTRIES.map((e) => [e.title, e]));
export const BY_KEY = new Map(SOW_ENTRIES.map((e) => [e.key, e]));

const TITLE_ALIASES = new Map<string, string>();
for (const entry of SOW_ENTRIES) {
  TITLE_ALIASES.set(entry.title, entry.key);
  const meta = CATALOG_IDENTITY_BY_TITLE[entry.title];
  for (const alias of meta?.aliases ?? []) {
    TITLE_ALIASES.set(alias, entry.key);
  }
}
for (const [alias, key] of Object.entries(SOFT_BACKFILL_TITLE_ALIASES)) {
  TITLE_ALIASES.set(alias, key);
}

function entryForClientPrefixedTitle(title: string): SowCatalogEntry | null {
  for (const entry of SOW_ENTRIES) {
    if (!entry.title.includes("[Client Name]")) continue;
    const prefix = entry.title.split("[Client Name]")[0] ?? "";
    if (prefix.length > 0 && title.startsWith(prefix)) return entry;
  }
  return null;
}

export function sowCatalogEntryByKey(key: string): SowCatalogEntry | null {
  return BY_KEY.get(key) ?? null;
}

export function sowCatalogEntry(title: string): SowCatalogEntry | null {
  const direct = BY_TITLE.get(title);
  if (direct) return direct;
  const aliasedKey = TITLE_ALIASES.get(title);
  if (aliasedKey) return BY_KEY.get(aliasedKey) ?? null;
  const prefixed = entryForClientPrefixedTitle(title);
  if (prefixed) return prefixed;
  return BY_KEY.get(title) ?? null;
}

export function allSowCatalogEntries(): SowCatalogEntry[] {
  return SOW_ENTRIES;
}

export function catalogCreatesInstances(
  entry: Pick<SowCatalogEntry, "disposition"> | null | undefined,
): boolean {
  if (!entry) return true;
  return entry.disposition === "obligation";
}

export function obligationCreatesInstances(ob: {
  title: string;
  key?: string | null;
  disposition?: string | null;
}): boolean {
  if (ob.disposition && ob.disposition !== "obligation") return false;
  const catalog =
    (ob.key ? sowCatalogEntryByKey(ob.key) : null) ?? sowCatalogEntry(ob.title);
  return catalogCreatesInstances(catalog);
}

/** Provider / pack / policy creates must not clone a catalog title. */
export function catalogTitleIsReserved(title: string): boolean {
  return sowCatalogEntry(title) != null;
}

export function resolveDueRule(
  title: string,
  cadence: string,
  dueDayConfig: Record<string, unknown> | null | undefined,
): DueRule | null {
  const catalog = sowCatalogEntry(title);
  if (catalog) return catalog.due_rule;
  return dueRuleFromConfig(cadence, dueDayConfig ?? {});
}

export function resolveDueExplanation(
  title: string,
  cadence: string,
  dueDayConfig: Record<string, unknown> | null | undefined,
): string | null {
  const rule = resolveDueRule(title, cadence, dueDayConfig);
  return rule ? explainDueRule(rule) : null;
}
