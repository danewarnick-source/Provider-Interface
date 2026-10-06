import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientIntakeChecklist, getClientsIntakeProgress } from "@/lib/client-hr.functions";
import { summarizeIntake } from "@/lib/intake-progress";

/**
 * Read-only intake progress derived from the existing client intake checklist.
 * "Required" = items without a `conditional` flag (same definition the
 * checklist card uses for its "Required items" tile). "Satisfied" = required
 * items whose status is `complete` or `waived` (mirrors the "Complete /
 * waived" roll-up).
 *
 * Returns `hasItems: false` when there are no base items yet (e.g. SOW not
 * parsed) — callers should render an empty/not-started state, not a 0/0 bar.
 */
export function useClientIntakeProgress(
  organizationId: string | undefined,
  clientId: string | undefined,
) {
  const fetchChecklist = useServerFn(getClientIntakeChecklist);
  const q = useQuery({
    enabled: !!organizationId && !!clientId,
    queryKey: ["client-intake-progress", organizationId, clientId],
    queryFn: () =>
      fetchChecklist({
        data: { organization_id: organizationId!, client_id: clientId! },
      }),
    retry: false,
    staleTime: 30_000,
  });

  const rows = q.data ?? [];
  const { required, satisfied } = summarizeIntake(
    rows.map((r) => ({ id: r.requirement_id, conditional: r.conditional })),
    new Map(rows.map((r) => [r.requirement_id, r.completion.status])),
  );
  const hasItems = rows.length > 0;
  const isComplete = hasItems && required > 0 && satisfied >= required;
  const pct = required > 0 ? Math.round((satisfied / required) * 100) : 0;

  return {
    isLoading: q.isLoading,
    error: q.error as Error | null,
    hasItems,
    required,
    satisfied,
    isComplete,
    pct,
  };
}

/** Intake progress for a whole list in one request, keyed by client id. */
export function useClientsIntakeProgress(organizationId: string | undefined, clientIds: string[]) {
  const fetchProgress = useServerFn(getClientsIntakeProgress);
  const ids = [...clientIds].sort();
  return useQuery({
    enabled: !!organizationId && ids.length > 0,
    queryKey: ["clients-intake-progress", organizationId, ids],
    queryFn: () => fetchProgress({ data: { organization_id: organizationId!, client_ids: ids } }),
    retry: false,
    staleTime: 30_000,
  });
}
