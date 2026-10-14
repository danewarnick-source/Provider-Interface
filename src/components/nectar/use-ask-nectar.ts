// The Ask call every Nectar screen uses (N5): askNectar for the question and
// feedbackNectar for thumbs. The screen names its view; the server checks it
// against the caller's access. An admin screen asks about the whole agency
// only for owners and agency-wide admins; anyone else gets their own scope.

import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-org";
import { isAgencyAdmin } from "@/lib/access/levels";
import { askNectar, feedbackNectar } from "@/lib/nectar/engine/ask.functions";
import type { AskView, FeedbackValue } from "@/lib/nectar/engine/ask-types";

export const WORKSPACE_LOADING = "Still loading your workspace. Try again in a moment.";

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
