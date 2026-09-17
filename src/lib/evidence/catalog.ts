/**
 * Curated Evidence pack catalog (in-repo). Suggestions only.
 * Not the 64-row mega sheet and not the requirement_defs applicability engine.
 */

import {
  SERVICE_CODE_FLAGS,
  type EvidencePackDef,
  type EvidenceRequirementDef,
  type EvidenceSubject,
  type QuestionnaireAnswers,
  type ServiceCodeFlag,
  type SuggestedPack,
} from "./types.ts";

export const EVIDENCE_REQUIREMENTS: readonly EvidenceRequirementDef[] = [
  {
    key: "cpr_first_aid",
    title: "CPR / First Aid",
    shortLabel: "CPR / First Aid",
    evidenceType: "upload",
    attestationText: null,
    cadence: "every_2_years",
    sowCite: "SOW §1.8(5)",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "background_screening",
    title: "Background screening",
    shortLabel: "Background screening",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.9(2)",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "thirty_day_orientation",
    title: "30-day orientation",
    shortLabel: "30-day orientation",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "SOW §1.8(4)",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "driving_record",
    title: "Driving record",
    shortLabel: "Driving record",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.30",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "auto_insurance_proof",
    title: "Auto insurance proof",
    shortLabel: "Insurance proof",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §1.30",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "mandt_behavior",
    title: "Mandt / behavior intervention",
    shortLabel: "Mandt / behavior",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.8(6)",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "abi_training",
    title: "ABI training",
    shortLabel: "ABI training",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "SOW §1.8 ABI",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "host_home_cert",
    title: "Host Home Certification",
    shortLabel: "Host Home Cert",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §11.5",
    subject: "staff",
    dualLink: "host_home_cert",
  },
  {
    key: "host_home_cert_client",
    title: "Host Home Certification",
    shortLabel: "Host Home Cert",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "SOW §11.5",
    subject: "client",
    dualLink: "host_home_cert",
  },
  {
    key: "sei_acre",
    title: "ACRE / customized employment training",
    shortLabel: "ACRE training",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "SOW SEI article",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "bc1_staff_cred",
    title: "BC1 staff credential",
    shortLabel: "BC1 credential",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW Articles 3–5",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "bc2_staff_cred",
    title: "BC2 staff credential",
    shortLabel: "BC2 credential",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW Articles 3–5",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "bc3_staff_cred",
    title: "BC3 staff credential",
    shortLabel: "BC3 credential",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW Articles 3–5",
    subject: "staff",
    dualLink: null,
  },
  {
    key: "bc1_fba_bsp",
    title: "BC1 FBA / BSP",
    shortLabel: "BC1 FBA / BSP",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW Articles 3–5",
    subject: "client",
    dualLink: null,
  },
  {
    key: "bc2_fba_bsp",
    title: "BC2 FBA / BSP",
    shortLabel: "BC2 FBA / BSP",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW Articles 3–5",
    subject: "client",
    dualLink: null,
  },
  {
    key: "bc3_fba_bsp",
    title: "BC3 FBA / BSP",
    shortLabel: "BC3 FBA / BSP",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW Articles 3–5",
    subject: "client",
    dualLink: null,
  },
  {
    key: "company_insurance",
    title: "Liability insurance",
    shortLabel: "Insurance",
    evidenceType: "upload",
    attestationText: null,
    cadence: "annual",
    sowCite: "CST 29–36",
    subject: "company",
    dualLink: null,
  },
  {
    key: "company_medicaid_enrollment",
    title: "Medicaid provider enrollment",
    shortLabel: "Medicaid enrollment",
    evidenceType: "upload",
    attestationText: null,
    cadence: "keep_current",
    sowCite: "SOW §1.4(1)",
    subject: "company",
    dualLink: null,
  },
  {
    key: "company_baa",
    title: "Business Associate Agreement",
    shortLabel: "BAA",
    evidenceType: "upload",
    attestationText: null,
    cadence: "once",
    sowCite: "Standing file",
    subject: "company",
    dualLink: null,
  },
] as const;

export const EVIDENCE_PACKS: readonly EvidencePackDef[] = [
  {
    key: "all_staff_starter",
    title: "All-staff starter",
    subject: "staff",
    description: "CPR / First Aid, background screening, and 30-day orientation.",
    requirementKeys: ["cpr_first_aid", "background_screening", "thirty_day_orientation"],
  },
  {
    key: "transport",
    title: "Transport",
    subject: "staff",
    description: "Driving record and insurance proof for staff who transport people.",
    requirementKeys: ["driving_record", "auto_insurance_proof"],
  },
  {
    key: "mandt_behavior",
    title: "Mandt / behavior",
    subject: "staff",
    description:
      "Behavior-intervention certification when the caseload may include aggression risk.",
    requirementKeys: ["mandt_behavior"],
  },
  {
    key: "abi",
    title: "ABI",
    subject: "staff",
    description: "ABI training before working alone with an ABI caseload.",
    requirementKeys: ["abi_training"],
  },
  {
    key: "hhs_staff",
    title: "HHS host-home file",
    subject: "staff",
    description: "Host Home Certification — same document dual-linked to the HHS client.",
    requirementKeys: ["host_home_cert"],
  },
  {
    key: "hhs_client",
    title: "HHS host-home file",
    subject: "client",
    description: "Host Home Certification — same document dual-linked to the host staff.",
    requirementKeys: ["host_home_cert_client"],
  },
  {
    key: "sei",
    title: "SEI",
    subject: "staff",
    description: "ACRE / customized employment training for SEI staff.",
    requirementKeys: ["sei_acre"],
  },
  {
    key: "bc1_staff",
    title: "BC1 staff creds",
    subject: "staff",
    description: "BC1 credential on the staff file.",
    requirementKeys: ["bc1_staff_cred"],
  },
  {
    key: "bc2_staff",
    title: "BC2 staff creds",
    subject: "staff",
    description: "BC2 credential on the staff file.",
    requirementKeys: ["bc2_staff_cred"],
  },
  {
    key: "bc3_staff",
    title: "BC3 staff creds",
    subject: "staff",
    description: "BC3 credential on the staff file.",
    requirementKeys: ["bc3_staff_cred"],
  },
  {
    key: "bc1_client",
    title: "BC1 client FBA / BSP",
    subject: "client",
    description: "Functional behavior assessment and behavior support plan for BC1.",
    requirementKeys: ["bc1_fba_bsp"],
  },
  {
    key: "bc2_client",
    title: "BC2 client FBA / BSP",
    subject: "client",
    description: "Functional behavior assessment and behavior support plan for BC2.",
    requirementKeys: ["bc2_fba_bsp"],
  },
  {
    key: "bc3_client",
    title: "BC3 client FBA / BSP",
    subject: "client",
    description: "Functional behavior assessment and behavior support plan for BC3.",
    requirementKeys: ["bc3_fba_bsp"],
  },
  {
    key: "company_starter",
    title: "Company starter",
    subject: "company",
    description:
      "Insurance, Medicaid enrollment, and BAA. Shift notes, EVV, and summaries stay in their own workflows.",
    requirementKeys: ["company_insurance", "company_medicaid_enrollment", "company_baa"],
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
  };
}

function hasCode(answers: QuestionnaireAnswers, code: ServiceCodeFlag): boolean {
  return answers.serviceCodes.includes(code);
}

/**
 * Branching suggestions. Conditional packs appear only when the matching
 * answer is on (HHS only if HHS, SEI only if SEI, BC only if that BC).
 */
export function suggestPacks(answers: QuestionnaireAnswers): SuggestedPack[] {
  const out: SuggestedPack[] = [];
  const add = (key: string, reason: string) => {
    const pack = packByKey(key);
    if (!pack) return;
    if (pack.subject !== answers.subject) return;
    if (out.some((row) => row.pack.key === pack.key)) return;
    out.push({ pack, reason });
  };

  if (answers.subject === "staff") {
    add("all_staff_starter", "Suggested for every staff file.");
    if (answers.transportsPeople) {
      add("transport", "Transports people — driving record / insurance proof.");
    }
    if (answers.worksWithAbi) add("abi", "Works with an ABI caseload.");
    if (answers.maySupportAggressiveBehavior) {
      add("mandt_behavior", "May support people with aggressive behavior.");
    }
    if (hasCode(answers, "HHS")) add("hhs_staff", "HHS selected — Host Home Certification.");
    if (hasCode(answers, "SEI")) add("sei", "SEI selected.");
    if (hasCode(answers, "BC1")) add("bc1_staff", "BC1 selected.");
    if (hasCode(answers, "BC2")) add("bc2_staff", "BC2 selected.");
    if (hasCode(answers, "BC3")) add("bc3_staff", "BC3 selected.");
  }

  if (answers.subject === "client") {
    if (hasCode(answers, "HHS")) add("hhs_client", "HHS selected — Host Home Certification.");
    if (hasCode(answers, "BC1")) add("bc1_client", "BC1 selected — FBA / BSP.");
    if (hasCode(answers, "BC2")) add("bc2_client", "BC2 selected — FBA / BSP.");
    if (hasCode(answers, "BC3")) add("bc3_client", "BC3 selected — FBA / BSP.");
  }

  if (answers.subject === "company") {
    add("company_starter", "Company standing file starter.");
  }

  return out;
}

export function suggestedRequirementKeys(answers: QuestionnaireAnswers): string[] {
  const keys = new Set<string>();
  for (const row of suggestPacks(answers)) {
    for (const key of row.pack.requirementKeys) keys.add(key);
  }
  return [...keys];
}

export function isSowSuggestedKey(key: string, answers: QuestionnaireAnswers): boolean {
  return suggestedRequirementKeys(answers).includes(key);
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
  if (cadence === "every_2_years") return "Renew every 2 years";
  if (cadence === "annual") return "Annual";
  if (cadence === "keep_current") return "Keep current";
  return "Once";
}

export function evidenceTypeLabel(type: string): string {
  return type === "attestation" ? "Attest or e-sign" : "Request upload";
}

export function parseServiceCodeFlags(raw: readonly string[]): ServiceCodeFlag[] {
  const allowed = new Set<string>(SERVICE_CODE_FLAGS);
  const out: ServiceCodeFlag[] = [];
  for (const value of raw) {
    const code = value.trim().toUpperCase();
    if (!allowed.has(code)) continue;
    if (!out.includes(code as ServiceCodeFlag)) out.push(code as ServiceCodeFlag);
  }
  return out;
}
