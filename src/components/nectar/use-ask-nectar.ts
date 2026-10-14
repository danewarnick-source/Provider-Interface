// The Ask call every Nectar screen uses (N5): askNectar for the question and
// feedbackNectar for thumbs. The screen names its view; the server checks it
// against the caller's access. An admin screen asks about the whole agency
// only for owners and agency-wide admins; anyone else gets their own scope.
// N6: both Ask screens read whether Ask is on before anyone asks.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-org";
import { isAgencyAdmin } from "@/lib/access/levels";
import { askNectar, feedbackNectar, getAskStatus } from "@/lib/nectar/engine/ask.functions";
import type { AskView, FeedbackValue } from "@/lib/nectar/engine/ask-types";

const WORKSPACE_LOADING = "Still loading your workspace. Try again in a moment.";

/** Query keys for the Nectar screens; every Nectar read sits under ["nectar", orgId]. */
export function nectarKey(orgId: string | null, ...parts: string[]) {
  return ["nectar", orgId, ...parts] as const;
}

export function useAskNectar(screen: AskView) {
  const { data: org } = useCurrentOrg();
  const askFn = useServerFn(askNectar);
  const rateFn = useServerFn(feedbackNectar);
  const organizationId = org?.organization_id ?? null;
  const view: AskView =
    screen === "admin" && org && isAgencyAdmin(org.access.level, org.access.scope)
      ? "admin"
      : "staff";

  return {
    organizationId,
    view,
    ask: (question: string) => {
      if (!organizationId) return Promise.reject(new Error(WORKSPACE_LOADING));
      return askFn({ data: { organizationId, question, view } });
    },
    rate: (questionId: string, value: FeedbackValue) => {
      if (!organizationId) return Promise.reject(new Error(WORKSPACE_LOADING));
      return rateFn({ data: { organizationId, questionId, value } });
    },
  };
}

/** Whether Ask is on for the agency (Nectar and Ask in AI settings), read on the server. */
export function useAskStatus(organizationId: string | null) {
  const fn = useServerFn(getAskStatus);
  return useQuery({
    queryKey: nectarKey(organizationId, "ask-status"),
    enabled: !!organizationId,
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
    staleTime: 60_000,
  });
}
