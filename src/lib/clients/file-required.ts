// The Client file's required documents, one row each, with status, due /
// expiry date and the file on record. Uploadable documents (exams, guardian
// papers, agreements, grievance receipt, 1056) carry their document type so
// the section can upload, replace or archive them; the rest (photo, PCSP,
// strategies, summaries, housemate, belongings, money) link to the section
// that keeps them. Pure.

import { addDaysYmd } from "./plan-dates.ts";
import {
  EXAM_CODES,
  LEASE_CODES,
  RNB_CODES,
  buildClientFileCards,
  clientFileStatus,
  codesHas,
  type ClientFileCardKey,
  type ClientFileFacts,
  type ClientFileStatus,
} from "./file.ts";
import { normType, type ClientFileDoc } from "./file-docs.ts";

export type RequiredDocSpec = {
  key: string;
  label: string;
  /** Document type a new upload is saved as. */
  docType: string;
  /** Older document types that also count. */
  alsoCounts?: string[];
  /** Renewed every year: a file without its own expiry date expires a year after upload. */
  yearly?: boolean;
  applies: (f: ClientFileFacts) => boolean;
};

export const REQUIRED_DOCS: readonly RequiredDocSpec[] = [
  {
    key: "1056",
    label: "1056 (service authorization)",
    docType: "1056_budget",
    alsoCounts: ["1056"],
    applies: (f) => f.codes.length > 0,
  },
  {
    key: "grievance",
    label: "Grievance receipt",
    docType: "grievance_acknowledgment",
    alsoCounts: ["grievance_policy"],
    applies: () => true,
  },
  {
    key: "guardian",
    label: "Guardian / legal papers",
    docType: "guardian",
    alsoCounts: ["contract"],
    applies: (f) => !f.isOwnGuardian,
  },
  {
    key: "medical_exam",
    label: "Medical exam",
    docType: "medical_exam",
    yearly: true,
    applies: (f) => codesHas(f.codes, EXAM_CODES),
  },
  {
    key: "dental_exam",
    label: "Dental exam",
    docType: "dental_exam",
    yearly: true,
    applies: (f) => codesHas(f.codes, EXAM_CODES),
  },
  {
    key: "room_board",
    label: "Room and board agreement",
    docType: "room_board_agreement",
    applies: (f) => codesHas(f.codes, RNB_CODES),
  },
  {
    key: "lease",
    label: "Lease agreement",
    docType: "lease_agreement",
    alsoCounts: ["lease"],
    applies: (f) => codesHas(f.codes, LEASE_CODES),
  },
];

/** Cards that are kept elsewhere in the profile; the file links to them. */
const LINK_CARDS: readonly ClientFileCardKey[] = [
  "photograph",
  "pcsp",
  "support_strategies",
  "service_summary",
  "housemate",
  "belongings",
  "money_funds",
];

export type RequiredDocRow = {
  key: string;
  label: string;
  status: ClientFileStatus;
  /** The expiry (or due) date, YYYY-MM-DD. */
  dueOn: string | null;
  /** Set when the document can be uploaded / replaced here. */
  docType: string | null;
  yearly: boolean;
  current: ClientFileDoc | null;
  /** Where the item is kept, for link rows. */
  href: string | null;
};

/** The last day a document counts: its own expiry, or a year after upload for yearly ones. */
export function documentExpiresOn(doc: ClientFileDoc, yearly: boolean): string | null {
  if (doc.expires_on) return doc.expires_on.slice(0, 10);
  const from = (doc.effective_from ?? doc.uploaded_at ?? "").slice(0, 10);
  return yearly && from ? addDaysYmd(from, 364) : null;
}

/** Suggested expiry for a new upload of `docType` (a year less a day for yearly documents). */
export function suggestedExpiry(docType: string, today: string): string | null {
  return REQUIRED_DOCS.find((s) => s.docType === docType)?.yearly ? addDaysYmd(today, 364) : null;
}

function newest(docs: ClientFileDoc[]): ClientFileDoc | null {
  return (
    [...docs].sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))[0] ?? null
  );
}

/** End of a local calendar day, for the status check. */
const endOfDay = (ymd: string | null) => (ymd ? `${ymd}T23:59:59` : null);

export function requiredDocuments(
  clientId: string,
  facts: ClientFileFacts,
  now: Date = new Date(),
): RequiredDocRow[] {
  const out: RequiredDocRow[] = [];
  for (const spec of REQUIRED_DOCS) {
    if (!spec.applies(facts)) continue;
    const types = new Set([spec.docType, ...(spec.alsoCounts ?? [])]);
    const current = newest(facts.docs.filter((d) => types.has(normType(d.document_type))));
    const dueOn = current ? documentExpiresOn(current, !!spec.yearly) : null;
    const alt = spec.key === "grievance" && facts.grievanceOk;
    out.push({
      key: spec.key,
      label: spec.label,
      status: clientFileStatus({ onFile: !!current || alt, dueAt: endOfDay(dueOn), now }),
      dueOn,
      docType: spec.docType,
      yearly: !!spec.yearly,
      current,
      href: null,
    });
  }
  for (const card of buildClientFileCards(clientId, facts, now)) {
    if (!LINK_CARDS.includes(card.key)) continue;
    out.push({
      key: card.key,
      label: card.title,
      status: card.status,
      dueOn: card.dueAt ? card.dueAt.slice(0, 10) : null,
      docType: null,
      yearly: false,
      current: null,
      href: card.href,
    });
  }
  return out;
}
