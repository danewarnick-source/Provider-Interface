// Client file document types and lookups shared by the file cards.

export const PCSP_DOC_TYPES = new Set(["pcsp", "person-centered", "person_centered", "individualized_plan"]);
export const GRIEVANCE_DOC_TYPES = new Set(["grievance_acknowledgment", "grievance_policy"]);
export const CLINICAL_LEGAL_DOC_TYPES = new Set([
  "medical_exam",
  "dental_exam",
  "contract",
  "guardian",
]);
export const STRATEGY_DOC_TYPES = new Set(["support_strategies", "bsp", "behavior_support_plan"]);
export const RNB_DOC_TYPES = new Set(["room_board_agreement"]);
export const LEASE_DOC_TYPES = new Set(["lease_agreement", "lease"]);
export const HOUSEMATE_DOC_TYPES = new Set(["housemate", "housemate_discussion", "housemate_informed_choice"]);

export type ClientFileDoc = {
  document_type: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  uploaded_at?: string | null;
};

export function normType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function docsOfType(docs: ClientFileDoc[], types: Set<string>): ClientFileDoc[] {
  return docs.filter((d) => types.has(normType(d.document_type)));
}

export function firstEvidence(docs: ClientFileDoc[]): {
  path: string | null;
  filename: string | null;
} {
  const hit = docs.find((d) => d.storage_path);
  return {
    path: hit?.storage_path ?? null,
    filename: hit?.file_name ?? null,
  };
}
