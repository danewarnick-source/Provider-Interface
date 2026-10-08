/**
 * Client file cards — same On file / Due soon / Missing labels as Personnel file.
 * One card per duty; renew keeps the same card. HRC restrictions stay in HRC.
 */

import {
  obligationFileStatusLabel,
  type ObligationFileStatus,
} from "../team-members/file.ts";
import { personNeedsSupportStrategies } from "./strategy-rules.ts";
import { strategyFileFact, type StrategySendState } from "./strategy-sends.ts";
import { summaryCard } from "./file-summary.ts";
import {
  CLINICAL_LEGAL_DOC_TYPES,
  GRIEVANCE_DOC_TYPES,
  HOUSEMATE_DOC_TYPES,
  LEASE_DOC_TYPES,
  PCSP_DOC_TYPES,
  RNB_DOC_TYPES,
  STRATEGY_DOC_TYPES,
  docsOfType,
  firstEvidence,
  liveDocs,
  normType,
  type ClientFileDoc,
} from "./file-docs.ts";

export type ClientFileStatus = ObligationFileStatus;

const DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export const CLIENT_FILE_CARD_KEYS = [
  "photograph",
  "pcsp",
  "grievance",
  "support_strategies",
  "service_summary",
  "clinical_legal",
  "housemate",
  "belongings",
  "lease_rb",
  "money_funds",
] as const;

export type ClientFileCardKey = (typeof CLIENT_FILE_CARD_KEYS)[number];

export const CLIENT_FILE_CARD_TITLE: Record<ClientFileCardKey, string> = {
  photograph: "Photograph",
  pcsp: "PCSP / planning documents",
  grievance: "Grievance receipt",
  support_strategies: "Support Strategies",
  service_summary: "Service summary",
  clinical_legal: "Client clinical/legal file area",
  housemate: "Housemate discussion",
  belongings: "Belongings inventory",
  lease_rb: "Lease/R&B",
  money_funds: "Money/funds",
};

/** Belongings inventory: taken once at move-in, no yearly renewal. */
export const BELONGINGS_CODES = new Set(["HHS", "PPS", "RHS", "SLH"]);
/** Yearly medical and dental exams are only required for these codes. */
export const EXAM_CODES = new Set(["RHS", "PPS", "HHS", "SLH"]);
/** A client photo needs retaking this many years after it was taken. */
export const PHOTO_VALID_YEARS = 5;
export const HOUSEMATE_CODES = new Set(["HHS", "PPS", "RHS"]);
export const RNB_CODES = new Set(["HHS", "PPS"]);
export const LEASE_CODES = new Set(["RHS"]);
export const FUNDS_CODES = new Set(["PBA"]);

export function clientFileStatusLabel(status: ClientFileStatus): string {
  return obligationFileStatusLabel(status);
}

/**
 * Client-file status. On file when the artifact is current.
 * Due soon in the 7-day window before a due/expiration (renews the same card).
 * Expired or absent is Missing.
 */
export function clientFileStatus(args: {
  onFile: boolean;
  dueAt?: string | null;
  now?: Date;
}): ClientFileStatus {
  const now = (args.now ?? new Date()).getTime();
  if (args.dueAt) {
    const due = new Date(args.dueAt).getTime();
    if (!Number.isNaN(due)) {
      if (due < now) return "missing";
      if (due - now <= DUE_SOON_MS) return "due_soon";
    }
  }
  return args.onFile ? "on_file" : "missing";
}

export function codesHas(codes: string[], set: Set<string>): boolean {
  return codes.some((c) => set.has(c.toUpperCase()));
}

export function cardApplies(key: ClientFileCardKey, codes: string[]): boolean {
  switch (key) {
    case "support_strategies":
      return personNeedsSupportStrategies(codes);
    case "housemate":
      return codesHas(codes, HOUSEMATE_CODES);
    case "belongings":
      return codesHas(codes, BELONGINGS_CODES);
    case "lease_rb":
      return codesHas(codes, RNB_CODES) || codesHas(codes, LEASE_CODES);
    case "money_funds":
      return codesHas(codes, FUNDS_CODES);
    default:
      return true;
  }
}

export type ClientFileSummary = {
  status: string | null;
  due_date: string;
  finalized_at: string | null;
  requires_upi_attestation?: boolean | null;
  upi_entered_at?: string | null;
  period_label?: string | null;
};

export type ClientFileFacts = {
  codes: string[];
  photoPath: string | null;
  /** client_photo_taken_on (YYYY-MM-DD); the photo expires 5 years later. */
  photoTakenOn: string | null;
  isOwnGuardian: boolean;
  grievanceOk: boolean;
  planEndDate: string | null;
  docs: ClientFileDoc[];
  belongingsOn: string | null;
  /** Support strategies sent to the support coordinator (strategy-sends.ts). */
  strategies: StrategySendState;
  housemateOnFile: boolean;
  housemateDueAt: string | null;
  summaries: ClientFileSummary[];
  hasPbaAccount: boolean;
};

export type ClientFileCard = {
  key: ClientFileCardKey;
  title: string;
  status: ClientFileStatus;
  dueAt: string | null;
  href: string;
  evidencePath: string | null;
  evidenceFilename: string | null;
  evidenceBucket: "client-documents" | "client-photos" | null;
};

/** The date a photo taken on `takenOn` expires (5 years later), or null. */
export function photoExpiresOn(takenOn: string | null | undefined): string | null {
  const [y, m, d] = (takenOn ?? "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${y + PHOTO_VALID_YEARS}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function clinicalLegalOnFile(facts: ClientFileFacts, docs: ClientFileDoc[]): boolean {
  const types = new Set(docs.map((d) => normType(d.document_type)));
  const needsExams = codesHas(facts.codes, EXAM_CODES);
  if (needsExams && !(types.has("medical_exam") && types.has("dental_exam"))) return false;
  if (facts.isOwnGuardian) return true;
  return types.has("contract") || types.has("guardian");
}

export function buildClientFileCards(
  clientId: string,
  facts: ClientFileFacts,
  now: Date = new Date(),
): ClientFileCard[] {
  const profile = `/dashboard/clients/${clientId}`;
  const cards: ClientFileCard[] = [];

  const push = (
    key: ClientFileCardKey,
    onFile: boolean,
    dueAt: string | null,
    href: string,
    evidence?: { path: string | null; filename: string | null; bucket: ClientFileCard["evidenceBucket"] },
  ) => {
    if (!cardApplies(key, facts.codes)) return;
    cards.push({
      key,
      title: CLIENT_FILE_CARD_TITLE[key],
      status: clientFileStatus({ onFile, dueAt, now }),
      dueAt,
      href,
      evidencePath: evidence?.path ?? null,
      evidenceFilename: evidence?.filename ?? null,
      evidenceBucket: evidence?.bucket ?? null,
    });
  };

  // Expired documents (past client_documents.expires_on) no longer count.
  const docs = liveDocs(facts.docs, now.toISOString().slice(0, 10));
  const pcspDocs = docsOfType(docs, PCSP_DOC_TYPES);
  const grievanceDocs = docsOfType(docs, GRIEVANCE_DOC_TYPES);
  const clinicalDocs = docsOfType(docs, CLINICAL_LEGAL_DOC_TYPES);
  const rnbDocs = docsOfType(docs, RNB_DOC_TYPES);
  const leaseDocs = docsOfType(docs, LEASE_DOC_TYPES);
  const housemateDocs = docsOfType(docs, HOUSEMATE_DOC_TYPES);
  const strategyDocs = docsOfType(docs, STRATEGY_DOC_TYPES);

  push(
    "photograph",
    !!facts.photoPath,
    facts.photoPath ? photoExpiresOn(facts.photoTakenOn) : null,
    `${profile}?section=profile`,
    facts.photoPath
      ? { path: facts.photoPath, filename: "photograph", bucket: "client-photos" }
      : undefined,
  );

  const pcspOnFile = pcspDocs.length > 0;
  push(
    "pcsp",
    pcspOnFile && !(facts.planEndDate && facts.planEndDate < now.toISOString().slice(0, 10)),
    facts.planEndDate,
    `${profile}?section=file`,
    { ...firstEvidence(pcspDocs), bucket: "client-documents" },
  );

  push(
    "grievance",
    facts.grievanceOk || grievanceDocs.length > 0,
    null,
    `${profile}?section=file`,
    { ...firstEvidence(grievanceDocs), bucket: "client-documents" },
  );

  const strategies = strategyFileFact(facts.strategies);
  push(
    "support_strategies",
    strategies.onFile,
    strategies.dueOn,
    `${profile}?section=plans`,
    { ...firstEvidence(strategies.onFile ? strategyDocs : []), bucket: "client-documents" },
  );

  const summary = summaryCard(facts, now);
  push("service_summary", summary.onFile, summary.dueAt, "/dashboard/summaries");

  push(
    "clinical_legal",
    clinicalLegalOnFile(facts, docs),
    null,
    `${profile}?section=file`,
    { ...firstEvidence(clinicalDocs), bucket: "client-documents" },
  );

  const housemateOnFile = facts.housemateOnFile || housemateDocs.length > 0;
  push(
    "housemate",
    housemateOnFile,
    housemateOnFile ? null : facts.housemateDueAt,
    `${profile}?section=file`,
    { ...firstEvidence(housemateDocs), bucket: "client-documents" },
  );

  push("belongings", !!facts.belongingsOn, null, `${profile}?section=file`);

  const needsRnb = codesHas(facts.codes, RNB_CODES);
  const needsLease = codesHas(facts.codes, LEASE_CODES);
  const leaseOk =
    (!needsRnb || rnbDocs.length > 0) && (!needsLease || leaseDocs.length > 0) && (needsRnb || needsLease);
  const leaseEvidence = firstEvidence(needsLease ? leaseDocs : rnbDocs);
  push(
    "lease_rb",
    leaseOk,
    null,
    `${profile}?section=file`,
    { ...leaseEvidence, bucket: "client-documents" },
  );

  push("money_funds", facts.hasPbaAccount, null, `${profile}?section=services`);

  return cards;
}

export type ClientFileCounts = {
  missing: number;
  due_soon: number;
  on_file: number;
};

export function tallyClientFileCards(cards: ClientFileCard[]): ClientFileCounts {
  const counts: ClientFileCounts = { missing: 0, due_soon: 0, on_file: 0 };
  for (const card of cards) counts[card.status] += 1;
  return counts;
}

export function isHousemateObligationTitle(title: string): boolean {
  return title.trim().toLowerCase().startsWith("housemate informed-choice");
}
