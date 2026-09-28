const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new Error("Invalid client id");
  return id;
}

/** PostgREST OR: primary client or an entry in additional_client_ids. */
export function incidentInvolvesClientOr(clientId: string): string {
  const id = assertUuid(clientId);
  return `client_id.eq.${id},additional_client_ids.cs.{${id}}`;
}

/** PostgREST OR for a caseload: primary client in the set, or array overlap. */
export function incidentInvolvesAnyClientOr(clientIds: readonly string[]): string {
  const ids = clientIds.filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return "id.eq.00000000-0000-0000-0000-000000000000";
  const list = ids.join(",");
  return `client_id.in.(${list}),additional_client_ids.ov.{${list}}`;
}

export function incidentVisibleForCaseload(
  row: { client_id: string | null; additional_client_ids?: readonly string[] | null },
  caseloadIds: ReadonlySet<string>,
): boolean {
  if (row.client_id && caseloadIds.has(row.client_id)) return true;
  return (row.additional_client_ids ?? []).some((id) => caseloadIds.has(id));
}
