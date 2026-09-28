/**
 * Duplicate-client check for smart import. Rows must be limited to the
 * target organization before they are compared. Callers use the service
 * role only after an executive or org-admin check.
 */

export function mayRunOrgWideClientDedup(input: {
  isExec: boolean | null | undefined;
  execRpcFailed: boolean;
  isOrgAdmin: boolean | null | undefined;
  adminRpcFailed: boolean;
}): boolean {
  if (!input.execRpcFailed && input.isExec === true) return true;
  if (!input.adminRpcFailed && input.isOrgAdmin === true) return true;
  return false;
}

export type DedupClientRow = {
  id: string;
  organization_id: string;
  medicaid_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

export function findDuplicateClientInOrg(
  rows: readonly DedupClientRow[],
  organizationId: string,
  extracted: {
    medicaid_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    date_of_birth?: string | null;
  },
): { matchedId: string | null; ambiguous: boolean } {
  const inOrg = rows.filter((row) => row.organization_id === organizationId);
  const mid = (extracted.medicaid_id ?? "").trim();
  if (mid) {
    const hits = inOrg.filter((row) => (row.medicaid_id ?? "") === mid);
    if (hits.length === 1) return { matchedId: hits[0]!.id, ambiguous: false };
    if (hits.length > 1) return { matchedId: null, ambiguous: true };
  }
  const fn = (extracted.first_name ?? "").trim();
  const ln = (extracted.last_name ?? "").trim();
  const dob = (extracted.date_of_birth ?? "").trim();
  if (fn && ln && dob) {
    const hits = inOrg.filter(
      (row) =>
        (row.first_name ?? "").toLowerCase() === fn.toLowerCase() &&
        (row.last_name ?? "").toLowerCase() === ln.toLowerCase(),
    );
    if (hits.length === 1) return { matchedId: hits[0]!.id, ambiguous: false };
    if (hits.length > 1) return { matchedId: null, ambiguous: true };
  }
  return { matchedId: null, ambiguous: false };
}
