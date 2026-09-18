/**
 * Curated Evidence pack catalog — ported from the product demo.
 * Staff / Client / Company catalogs do not share rows except Host Home Cert.
 */

import {
  CLIENT_QUIZ_CODES,
  EVIDENCE_CADENCE_OPTIONS,
  STAFF_QUIZ_CODES,
  type EvidenceHelpLink,
  type EvidencePackDef,
  type EvidenceRequirementDef,
  type EvidenceSubject,
  type QuestionnaireAnswers,
  type ServiceCodeFlag,
  type SuggestedPack,
} from "./types.ts";

export const EVIDENCE_HELP_LINKS = {
  oig: { label: "Check OIG exclusions", href: "https://exclusions.oig.hhs.gov/" },
  dspd: { label: "DSPD provider resources", href: "https://dspd.utah.gov/" },
  rules: {
    label: "Utah Admin Rules (R539)",
    href: "https://adminrules.utah.gov/public/rule/R539/Current%20Rules",
  },
  coc: { label: "DHHS / DSPD provider info", href: "https://dspd.utah.gov/providers/" },
  host: { label: "DSPD forms & tools", href: "https://dspd.utah.gov/providers/" },
} as const satisfies Record<string, EvidenceHelpLink>;

function req(
  partial: Omit<EvidenceRequirementDef, "shortLabel" | "links"> & {
    shortLabel?: string;
    links?: readonly EvidenceHelpLink[];
  },
): EvidenceRequirementDef {
  return {
    ...partial,
    shortLabel: partial.shortLabel ?? partial.title,
    links: partial.links ?? [],
  };
}

export const EVIDENCE_REQUIREMENTS: readonly EvidenceRequirementDef[] = [
  req({
    key: "cpr_first_aid",
    title: "CPR / First Aid",
    evidenceType: "upload",
    attestationText: null,
    cadence: "every_2_years",
    sowCite: "SOW §1.8(5)",
    cadenceDisplay: "Every 2 years · SOW §1.8(5)",
    why: "Keep a current CPR and first aid certificate for staff who support people you serve. Renew before expiration so someone is prepared in a medical emergency.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "background_screening",
    title: "Background screening",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.9(2)",
    cadenceDisplay: "Annual · SOW §1.9(2)",
    why: "Utah requires a DHHS background check through the Office of Background Processing before—and while—someone works with people you serve. Store the clearance result on this file.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "thirty_day_orientation",
    title: "30-day orientation",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "SOW §1.8(4)",
    cadenceDisplay: "Once · SOW §1.8(4)",
    why: "New staff must complete orientation (rights, abuse reporting, agency policies, person-specific needs, and related topics) within 30 days. Upload completion proof or finish training in the platform.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "medicaid_disclosure",
    title: "Medicaid Disclosure",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.13.5",
    cadenceDisplay: "Annual · SOW §1.13.5",
    why: "Staff complete a Medicaid disclosure form confirming they understand program rules. Keep the signed form on the staff file and renew annually.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "oig_exclusion",
    title: "OIG / fraud exclusion check",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.9(7)",
    cadenceDisplay: "Annual · SOW §1.9(7)",
    why: "Confirm this person is not on the federal OIG exclusion list (individuals barred from federal health programs). Run the search, save a screenshot or printout, and re-check on your schedule.",
    links: [EVIDENCE_HELP_LINKS.oig],
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "code_of_conduct",
    title: "Code of Conduct acknowledgment",
    evidenceType: "attestation",
    attestationText: "I have read the agency Code of Conduct and agree to follow it while working.",
    cadence: "annual",
    sowCite: "CST / R380-80",
    cadenceDisplay: "Annual · CST / R380-80",
    why: "Staff should read your Code of Conduct and confirm they understand expectations for working with people, families, and colleagues. DSPD/DHHS provider materials can help if you are building or updating yours.",
    links: [EVIDENCE_HELP_LINKS.coc, EVIDENCE_HELP_LINKS.dspd],
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "conflict_of_interest",
    title: "Conflict of Interest disclosure",
    evidenceType: "attestation",
    attestationText: "I have disclosed any conflicts of interest as required by agency policy.",
    cadence: "annual",
    sowCite: "CST",
    cadenceDisplay: "Annual · CST",
    why: "Staff disclose outside employment, family relationships, or financial ties that could affect their work. This protects the people you serve and supports transparency with the State.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "driving_record",
    title: "Driving record (MVR)",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.30",
    cadenceDisplay: "Annual · SOW §1.30",
    why: "If this person transports people you support, obtain a motor vehicle record and confirm their driving history meets your agency policy.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "driver_license",
    title: "Driver license",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.30",
    cadenceDisplay: "On expiry · SOW §1.30",
    why: "Keep a copy of a valid driver license for anyone who transports. Replace it when the license is renewed or updated.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "auto_insurance_proof",
    title: "Auto insurance proof",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.30",
    cadenceDisplay: "Annual · SOW §1.30",
    why: "If they use a personal vehicle for work transport, keep current insurance proof on file for agency coverage and audit readiness.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "transport_safety_attest",
    title: "Transport safety attestation",
    evidenceType: "attestation",
    attestationText: "I will follow agency transport rules when driving people we support.",
    cadence: "once",
    sowCite: "SOW §1.30",
    cadenceDisplay: "Once · SOW §1.30",
    why: "A short signed statement confirming they will follow agency transport rules (seat belts, no phone use while driving, approved practices, and related expectations).",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "abi_training",
    title: "ABI training",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "SOW §1.8(8)",
    cadenceDisplay: "Once before alone · SOW §1.8(8)",
    why: "Staff who work alone with a person who has an acquired brain injury need ABI-specific training first. Upload completion proof before that assignment begins.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "mandt_behavior",
    title: "Behavior intervention certification",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.8(6)",
    cadenceDisplay: "On expiry · SOW §1.8(6)",
    why: "If this person may support people with aggressive behavior, they need an approved behavior-intervention certification (Mandt or equivalent). Keep certification current.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "host_home_cert",
    title: "Host Home Certification",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §11.5",
    cadenceDisplay: "Annual · SOW §11.5",
    why: "Before Host Home services—and annually afterward—the home must be inspected and certified as safe and appropriate for the person’s needs. Use DSPD’s Host Home Certification form or an equivalent checklist covering the same elements. The same file also appears on the client record.",
    links: [EVIDENCE_HELP_LINKS.host],
    subject: "staff",
    dualLink: "host_home_cert",
  }),
  req({
    key: "host_age_21",
    title: "Host age ≥21",
    evidenceType: "attestation",
    attestationText: "I confirm this host is at least 21 years of age.",
    cadence: "once",
    sowCite: "SOW §11.6",
    cadenceDisplay: "Once · SOW §11.6",
    why: "Host Home hosts must be at least 21 years of age. Confirm once and retain that confirmation on the host’s staff file.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "sei_prior_training",
    title: "SEI prior training",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "SOW §30.5 / §30.6.c",
    cadenceDisplay: "Once · SOW §30.5 / §30.6.c",
    why: "Staff delivering Supported Employment for an Individual need SEI-specific training before they begin. Upload proof of completion here.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "sei_acre",
    title: "ACRE certification",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §30.6.b",
    cadenceDisplay: "On expiry · SOW §30.6.b",
    why: "The agency must maintain at least one ACRE-certified staff member. If this person holds that credential, keep their ACRE certificate on file.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "bc1_staff_cred",
    title: "BC1 staff credential",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §3.6",
    cadenceDisplay: "On expiry · SOW §3.6",
    why: "Behavior Consultation I staff must meet Option A or B (experience, degree, and DOPL license or exemption). Upload licenses, transcripts, and any exemption letter that applies.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "bc2_staff_cred",
    title: "BC2 staff credential",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §4.6",
    cadenceDisplay: "On expiry · SOW §4.6",
    why: "BC2 allows several credential paths (BCaBA/LaBA, master’s with RBS/RaBS, supervised student pathway, or DOPL exemption). Keep documentation that matches the path this staff member uses.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "bc3_staff_cred",
    title: "BC3 staff credential",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §5.6",
    cadenceDisplay: "On expiry · SOW §5.6",
    why: "BC3 applies to complex or dangerous behavior cases. Staff must meet a BC3 pathway (BCBA with LBA, doctorate with psychologist license, supervised BCBA-student path, or DOPL exemption). Upload the matching credentials.",
    subject: "staff",
    dualLink: null,
  }),
  req({
    key: "client_photo",
    title: "Photograph",
    evidenceType: "upload",
    attestationText: null,
    cadence: "every_5_years",
    sowCite: "SOW §1.10(3)",
    cadenceDisplay: "Every 5 years · SOW §1.10(3)",
    why: "Keep a current photograph in the person’s file so staff and emergency responders can identify them. Replace it at least every five years, or sooner if appearance changes significantly.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "client_pcsp",
    title: "Current PCSP on file",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.10",
    cadenceDisplay: "As updated · SOW §1.10",
    why: "The Person-Centered Support Plan (PCSP) is the State’s plan for this person’s services and goals. Keep the current PCSP and updates readily available for staff and auditors.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "grievance_receipt",
    title: "Grievance signed receipt",
    evidenceType: "attestation",
    attestationText: "Person/guardian received and acknowledged the grievance procedure.",
    cadence: "once",
    sowCite: "SOW §1.10(11)",
    cadenceDisplay: "Once on admit · SOW §1.10(11)",
    why: "At admission, the person or guardian must receive your grievance process in writing and acknowledge receipt. This documents that they know how to raise concerns.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "support_strategies",
    title: "Support Strategies",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.24(5)",
    cadenceDisplay: "With PCSP · SOW §1.24(5)",
    why: "Support Strategies describe how staff will help with PCSP goals day to day. Keep the current strategies with the person’s file (a BSP serves this role for behavior consultation).",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "clinical_legal_uploads",
    title: "Clinical / legal file uploads",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.10",
    cadenceDisplay: "As needed · SOW §1.10",
    why: "Store medical, dental, DNR, guardianship, and related documents staff may need. Upload only what applies to this person.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "host_home_cert_client",
    title: "Host Home Certification",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §11.5",
    cadenceDisplay: "Annual · SOW §11.5",
    why: "Same home certification as on the host’s staff file. Demonstrates that the residence where this person lives has been inspected and certified.",
    links: [EVIDENCE_HELP_LINKS.host],
    subject: "client",
    dualLink: "host_home_cert",
  }),
  req({
    key: "room_board_agreement",
    title: "Room & board agreement",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §11.3.9",
    cadenceDisplay: "Current · SOW §11.3.9",
    why: "Written agreement covering room and board for the Host Home arrangement. Keep it current for as long as the person lives there.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "belongings_inventory_hhs",
    title: "Belongings inventory",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §11.3.5",
    cadenceDisplay: "Annual · SOW §11.3.5",
    why: "A dated inventory of the person’s belongings in the home. Supports accountability if items are missing and is commonly reviewed in residential audits.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "housemate_discussion",
    title: "Housemate informed discussion",
    evidenceType: "attestation",
    attestationText: "Informed discussion about housemate(s) was completed.",
    cadence: "keep_current",
    sowCite: "SOW §1.35",
    cadenceDisplay: "On change · SOW §1.35",
    why: "When housemates change in HHS, PPS, or RHS, document that you discussed living arrangements and preferences with the person.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "lease_housing",
    title: "Lease / housing agreement",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "RHS residence",
    cadenceDisplay: "Current",
    why: "For residential habilitation, keep the lease or housing agreement that documents where the person lives and under what terms.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "form_930",
    title: "Form 930 (enhanced staffing)",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §21.3.4",
    cadenceDisplay: "Before enhanced · SOW §21.3.4",
    why: "If this person receives enhanced staffing, Form 930 must be complete before that level of support begins. Skip this item if enhanced staffing does not apply.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "belongings_inventory_rhs",
    title: "Belongings inventory",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §21.3.7",
    cadenceDisplay: "Annual · SOW §21.3.7",
    why: "Same purpose as the HHS inventory: a dated list of belongings for the residential setting.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "fba_on_file",
    title: "FBA on file",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §3/4/5.3",
    cadenceDisplay: "Per SOW timelines · §3/4/5.3",
    why: "A Functional Behavior Assessment (FBA) explains why target behaviors occur. Keep the completed FBA in the person’s file and update it when the plan changes.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "bsp_on_file",
    title: "BSP on file",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §3/4/5.4",
    cadenceDisplay: "Monthly reevaluate · §3/4/5.4",
    why: "The Behavior Support Plan (BSP) guides how staff respond and teach replacement skills. Keep the current BSP here; behavior consultants reevaluate it monthly.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "employment_supports",
    title: "Employment supports / strategies",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §30.2.7",
    cadenceDisplay: "As updated · SOW §30.2.7",
    why: "Written plans for helping this person maintain or increase job independence. Update when the job or supports change.",
    subject: "client",
    dualLink: null,
  }),
  req({
    key: "company_bylaws",
    title: "Bylaws / governing documents",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.14",
    cadenceDisplay: "As updated · SOW §1.14",
    why: "Bylaws and governing documents describe how your agency is organized (board, ownership, and decision-making). Auditors may request them; keep a current copy available. Update only when the organization changes.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_board_minutes",
    title: "Board minutes",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.14",
    cadenceDisplay: "As updated · SOW §1.14",
    why: "Board minutes record who attended and what was decided. Keep them organized so leadership can produce them quickly if DSPD requests them (often within a few days).",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_personnel_pp",
    title: "Personnel policies & job descriptions",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.17",
    cadenceDisplay: "Annual review · SOW §1.17",
    why: "Written personnel policies and a job description for each role set expectations for hiring, duties, and workplace conduct. Review annually and upload the current packet.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_operating_pp",
    title: "Operating policies & procedures",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.18",
    cadenceDisplay: "Annual review · SOW §1.18",
    why: "Operating policies cover day-to-day service delivery, records, transport, incidents, and related practices. Keep the current playbook available to staff.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_health_pp",
    title: "Health support policies",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.23",
    cadenceDisplay: "Annual review · SOW §1.23",
    why: "Health support policies describe how your agency handles medications, emergencies, and when to call 911. They give staff clear direction in medical situations.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_hrc",
    title: "Human Rights Committee established",
    evidenceType: "attestation",
    attestationText: "Our agency has a Human Rights Committee that meets Utah rule requirements.",
    cadence: "keep_current",
    sowCite: "SOW §1.20",
    cadenceDisplay: "Once / maintain · SOW §1.20",
    why: "Most providers must maintain a Human Rights Committee that reviews rights restrictions. Attest that yours exists and meets Utah rule requirements; keep detailed meeting records in your usual process.",
    links: [EVIDENCE_HELP_LINKS.rules],
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_hrp",
    title: "Human Rights Plan",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.21",
    cadenceDisplay: "As updated · SOW §1.21",
    why: "A written Human Rights Plan describes how your agency protects and restores rights. Upload the current plan (some limited service types may be exempt—confirm in your SOW).",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_coc_posted",
    title: "Code of Conduct posted / client rights",
    evidenceType: "attestation",
    attestationText:
      "Code of Conduct / client rights materials are posted or provided and reviewed annually.",
    cadence: "annual",
    sowCite: "CST",
    cadenceDisplay: "Annual · CST",
    why: "People you serve should have access to their rights information and your conduct expectations. Confirm materials are posted or provided, and review them annually.",
    links: [EVIDENCE_HELP_LINKS.coc],
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_insurance",
    title: "Insurance certificates",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "CST",
    cadenceDisplay: "On expiry · CST",
    why: "Proof your agency carries required insurance (general liability, auto if you transport, and professional liability when applicable). Replace files when policies renew.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_medicaid_enrollment",
    title: "Medicaid standing / manuals awareness",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.7",
    cadenceDisplay: "Annual · SOW §1.7",
    why: "Document that the agency remains in good standing with Medicaid and that leadership is familiar with the manuals and rules under which you bill. Often a memo plus enrollment letters.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_baa",
    title: "BAA documentation",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "HIPAA",
    cadenceDisplay: "As updated · HIPAA",
    why: "Business Associate Agreements with vendors who handle protected health information. Keep signed BAAs available to demonstrate HIPAA arrangements if requested.",
    subject: "company",
    dualLink: null,
  }),
  req({
    key: "company_custom",
    title: "Custom company requirement",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "Agency",
    cadenceDisplay: "You set · Agency",
    why: "Add an agency-only custom item (for example an internal checklist). This is optional and not required by the SOW.",
    subject: "company",
    dualLink: null,
  }),
] as const;

function hasCode(answers: QuestionnaireAnswers, code: ServiceCodeFlag): boolean {
  return answers.serviceCodes.includes(code);
}

export const EVIDENCE_PACKS: readonly EvidencePackDef[] = [
  {
    key: "all_staff",
    title: "All-staff",
    chip: "All-staff",
    subject: "staff",
    description: "Personnel file suggested for every staff member.",
    requirementKeys: [
      "cpr_first_aid",
      "background_screening",
      "thirty_day_orientation",
      "medicaid_disclosure",
      "oig_exclusion",
      "code_of_conduct",
      "conflict_of_interest",
    ],
    when: () => true,
  },
  {
    key: "transport",
    title: "Transport",
    chip: "Transport",
    subject: "staff",
    description: "Driving record, license, insurance, and transport rules.",
    requirementKeys: [
      "driving_record",
      "driver_license",
      "auto_insurance_proof",
      "transport_safety_attest",
    ],
    when: (a) => a.transportsPeople,
  },
  {
    key: "abi",
    title: "ABI",
    chip: "ABI",
    subject: "staff",
    description: "ABI training before working alone with an ABI caseload.",
    requirementKeys: ["abi_training"],
    when: (a) => a.worksWithAbi,
  },
  {
    key: "mandt_behavior",
    title: "Mandt / behavior",
    chip: "Mandt / behavior",
    subject: "staff",
    description: "Behavior-intervention certification when aggression risk applies.",
    requirementKeys: ["mandt_behavior"],
    when: (a) => a.maySupportAggressiveBehavior,
  },
  {
    key: "hhs_staff",
    title: "HHS host",
    chip: "HHS host",
    subject: "staff",
    description: "Host Home Certification — same file dual-linked to the HHS client.",
    requirementKeys: ["host_home_cert", "host_age_21"],
    when: (a) => hasCode(a, "HHS"),
  },
  {
    key: "sei",
    title: "SEI",
    chip: "SEI",
    subject: "staff",
    description: "SEI prior training and ACRE certification.",
    requirementKeys: ["sei_prior_training", "sei_acre"],
    when: (a) => hasCode(a, "SEI"),
  },
  {
    key: "bc1_staff",
    title: "BC1",
    chip: "BC1",
    subject: "staff",
    description: "BC1 staff credential on the personnel file.",
    requirementKeys: ["bc1_staff_cred"],
    when: (a) => hasCode(a, "BC1"),
  },
  {
    key: "bc2_staff",
    title: "BC2",
    chip: "BC2",
    subject: "staff",
    description: "BC2 staff credential on the personnel file.",
    requirementKeys: ["bc2_staff_cred"],
    when: (a) => hasCode(a, "BC2"),
  },
  {
    key: "bc3_staff",
    title: "BC3",
    chip: "BC3",
    subject: "staff",
    description: "BC3 staff credential on the personnel file.",
    requirementKeys: ["bc3_staff_cred"],
    when: (a) => hasCode(a, "BC3"),
  },
  {
    key: "client_core",
    title: "Client file",
    chip: "Client file",
    subject: "client",
    description: "Photograph, PCSP, grievance, strategies, and clinical uploads.",
    requirementKeys: [
      "client_photo",
      "client_pcsp",
      "grievance_receipt",
      "support_strategies",
      "clinical_legal_uploads",
    ],
    when: () => true,
  },
  {
    key: "hhs_client",
    title: "HHS residence",
    chip: "HHS residence",
    subject: "client",
    description: "Host Home Certification plus residence paperwork.",
    requirementKeys: [
      "host_home_cert_client",
      "room_board_agreement",
      "belongings_inventory_hhs",
      "housemate_discussion",
    ],
    when: (a) => hasCode(a, "HHS"),
  },
  {
    key: "rhs_client",
    title: "RHS residence",
    chip: "RHS residence",
    subject: "client",
    description: "Lease, Form 930, and belongings inventory.",
    requirementKeys: ["lease_housing", "form_930", "belongings_inventory_rhs"],
    when: (a) => hasCode(a, "RHS"),
  },
  {
    key: "bc_client",
    title: "Behavior consultation file",
    chip: "Behavior consultation",
    subject: "client",
    description: "FBA and BSP for BC1 / BC2 / BC3.",
    requirementKeys: ["fba_on_file", "bsp_on_file"],
    when: (a) => hasCode(a, "BC1") || hasCode(a, "BC2") || hasCode(a, "BC3"),
  },
  {
    key: "sei_client",
    title: "Employment (SEI)",
    chip: "Employment (SEI)",
    subject: "client",
    description: "Employment supports and strategies.",
    requirementKeys: ["employment_supports"],
    when: (a) => hasCode(a, "SEI"),
  },
  {
    key: "company_governance",
    title: "Governance",
    chip: "Governance",
    subject: "company",
    description: "Bylaws and board minutes.",
    requirementKeys: ["company_bylaws", "company_board_minutes"],
    when: () => true,
  },
  {
    key: "company_policies",
    title: "Policies & procedures",
    chip: "Policies & procedures",
    subject: "company",
    description: "Personnel, operating, and health support policies.",
    requirementKeys: ["company_personnel_pp", "company_operating_pp", "company_health_pp"],
    when: () => true,
  },
  {
    key: "company_rights",
    title: "Rights",
    chip: "Rights",
    subject: "company",
    description: "Human Rights Committee, plan, and posted rights.",
    requirementKeys: ["company_hrc", "company_hrp", "company_coc_posted"],
    when: () => true,
  },
  {
    key: "company_standing",
    title: "Agency standing",
    chip: "Agency standing",
    subject: "company",
    description: "Insurance, Medicaid standing, and BAAs.",
    requirementKeys: ["company_insurance", "company_medicaid_enrollment", "company_baa"],
    when: () => true,
  },
  {
    key: "company_optional",
    title: "Optional agency customs",
    chip: "Optional",
    subject: "company",
    description: "Optional agency-only custom slot.",
    requirementKeys: ["company_custom"],
    when: (a) => a.includeCompanyCustoms,
  },
] as const;

const REQ_BY_KEY = new Map(EVIDENCE_REQUIREMENTS.map((r) => [r.key, r]));
const PACK_BY_KEY = new Map(EVIDENCE_PACKS.map((p) => [p.key, p]));

export function requirementByKey(key: string): EvidenceRequirementDef | null {
  return REQ_BY_KEY.get(key) ?? null;
}

export function packByKey(key: string): EvidencePackDef | null {
  return PACK_BY_KEY.get(key) ?? null;
}

export function packsForSubject(subject: EvidenceSubject): EvidencePackDef[] {
  return EVIDENCE_PACKS.filter((p) => p.subject === subject);
}

export function requirementsForPack(packKey: string): EvidenceRequirementDef[] {
  const pack = packByKey(packKey);
  if (!pack) return [];
  return pack.requirementKeys
    .map((key) => requirementByKey(key))
    .filter((row): row is EvidenceRequirementDef => !!row);
}

export function defaultQuestionnaireAnswers(subject: EvidenceSubject): QuestionnaireAnswers {
  return {
    subject,
    serviceCodes: [],
    transportsPeople: subject === "staff",
    worksWithAbi: false,
    maySupportAggressiveBehavior: false,
    includeCompanyCustoms: false,
  };
}

export function suggestPacks(answers: QuestionnaireAnswers): SuggestedPack[] {
  return EVIDENCE_PACKS.filter(
    (pack) => pack.subject === answers.subject && pack.when(answers),
  ).map((pack) => ({ pack, reason: pack.description }));
}

export function suggestedRequirementKeys(answers: QuestionnaireAnswers): string[] {
  const keys = new Set<string>();
  for (const row of suggestPacks(answers)) {
    for (const key of row.pack.requirementKeys) keys.add(key);
  }
  return [...keys];
}

export function chipsForRequirementKey(
  key: string,
  suggested: readonly SuggestedPack[] = [],
): string[] {
  const fromSuggested = suggested
    .filter((row) => row.pack.requirementKeys.includes(key))
    .map((row) => row.pack.chip);
  if (fromSuggested.length > 0) return [...new Set(fromSuggested)];
  return [
    ...new Set(EVIDENCE_PACKS.filter((p) => p.requirementKeys.includes(key)).map((p) => p.chip)),
  ];
}

export function isSowSuggestedKey(key: string, answers: QuestionnaireAnswers): boolean {
  if (!suggestedRequirementKeys(answers).includes(key)) return false;
  const sow = requirementByKey(key)?.sowCite ?? "";
  return /SOW/i.test(sow);
}

export function hostHomeDualLinkPeerKey(requirementKey: string): string | null {
  if (requirementKey === "host_home_cert") return "host_home_cert_client";
  if (requirementKey === "host_home_cert_client") return "host_home_cert";
  return null;
}

export function isBuiltInTaxFormKey(key: string): boolean {
  return /^(w-?9|i-?9)$/i.test(key.trim());
}

export function cadenceLabel(cadence: string): string {
  const found = EVIDENCE_CADENCE_OPTIONS.find((row) => row.value === cadence);
  return found?.label ?? "Once";
}

export function evidenceTypeLabel(type: string): string {
  return type === "attestation" ? "Attestation" : "Upload";
}

export function parseServiceCodeFlags(raw: readonly string[]): ServiceCodeFlag[] {
  const allowed = new Set<string>([
    ...STAFF_QUIZ_CODES,
    ...CLIENT_QUIZ_CODES,
    "SLH",
  ] as ServiceCodeFlag[]);
  const out: ServiceCodeFlag[] = [];
  for (const value of raw) {
    const code = value.trim().toUpperCase();
    if (!allowed.has(code)) continue;
    if (!out.includes(code as ServiceCodeFlag)) out.push(code as ServiceCodeFlag);
  }
  return out;
}

export function quizCodesForSubject(subject: EvidenceSubject): readonly ServiceCodeFlag[] {
  if (subject === "client") return CLIENT_QUIZ_CODES;
  if (subject === "staff") return STAFF_QUIZ_CODES;
  return [];
}

/** Keys that must never appear on another subject's catalog (except the HHS dual-link pair). */
export function catalogSubjectsArePartitioned(): boolean {
  const seen = new Map<string, EvidenceSubject>();
  for (const row of EVIDENCE_REQUIREMENTS) {
    const prev = seen.get(row.key);
    if (prev && prev !== row.subject) return false;
    seen.set(row.key, row.subject);
  }
  return true;
}
