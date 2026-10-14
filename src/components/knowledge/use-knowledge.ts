import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import type { KnowledgeSearch, KnowledgeTab } from "@/lib/nectar/library/knowledge-nav";
import { getRequiredPolicies } from "@/lib/nectar/library/library.functions";

const knowledgeRoute = getRouteApi("/dashboard/hub/knowledge");

/**
 * Who may use the Knowledge base screens. The server checks the same rule on
 * every call (agency_settings View to read, Edit to change, agency-wide).
 */
export function useKnowledgeAccess() {
  const { data: org } = useCurrentOrg();
  const { isAgencyAdmin, canCategory, isLoading } = useAccess();
  const canView = isAgencyAdmin && canCategory("agency_settings", "view");
  return {
    orgId: org?.organization_id ?? null,
    canView,
    canEdit: canView && canCategory("agency_settings", "edit"),
    isLoading,
  };
}

/** Query keys; every Knowledge base read sits under ["knowledge", orgId]. */
export function knowledgeKey(orgId: string | null, ...parts: string[]) {
  return ["knowledge", orgId, ...parts] as const;
}

/** After a change, refetch every Knowledge base read for the agency. */
export function useRefreshKnowledge(orgId: string | null) {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: knowledgeKey(orgId) }), [qc, orgId]);
}

export function useKnowledgeSearch(): KnowledgeSearch {
  return knowledgeRoute.useSearch();
}

/** Moves between the tabs, a document, a state rule and New document (search params). */
export function useKnowledgeNav() {
  const navigate = knowledgeRoute.useNavigate();
  const search = knowledgeRoute.useSearch();
  const tab = search.tab;
  const go = useCallback((next: KnowledgeSearch) => void navigate({ search: next }), [navigate]);
  return {
    home: (to: KnowledgeTab | undefined = tab) => go(to && to !== "library" ? { tab: to } : {}),
    openDocument: (id: string) => go({ doc: id, tab }),
    openStateRule: (id: string) => go({ rule: id, tab }),
    newDocument: (opts: { slot?: string; question?: string } = {}) =>
      go({ new: true, ...opts, tab }),
  };
}

/** The 10 required slots with their status; also feeds "(N missing)" and New document's slot list. */
export function useRequiredPolicies(orgId: string) {
  const fn = useServerFn(getRequiredPolicies);
  return useQuery({
    queryKey: knowledgeKey(orgId, "required"),
    queryFn: () => fn({ data: { organizationId: orgId } }),
  });
}
