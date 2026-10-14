// Admin Nectar's reads and writes (N6): who may see Questions and AI settings,
// the Questions tab, its open count and AI settings. The server checks the
// same rule on every call (agency_settings View to read, Edit to change, for
// the whole agency).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import {
  countOpenNectarQuestions,
  getNectarSettings,
  listNectarQuestions,
  saveNectarSettings,
  setNectarQuestionStatus,
} from "@/lib/nectar/engine/admin.functions";
import type { NectarSettings } from "@/lib/nectar/engine/guard";
import type { QuestionFilter, QuestionStatus } from "@/lib/nectar/engine/questions-admin";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { nectarKey } from "../use-ask-nectar";

/** A call the server refused for access reads differently from a failure. */
const REFUSED = /forbidden|only an owner|not a member|insufficient access/i;

export function isRefusal(error: unknown): boolean {
  return REFUSED.test(safeErrorMessage(error, ""));
}

/** Retry a failed read once, but never a refusal, so a refused screen shows at once. */
function retryUnlessRefused(failures: number, error: unknown): boolean {
  return failures < 1 && !isRefusal(error);
}

export function useNectarAdminAccess() {
  const { data: org } = useCurrentOrg();
  const { isAgencyAdmin, canCategory, isLoading } = useAccess();
  const canView = isAgencyAdmin && canCategory("agency_settings", "view");
  return {
    orgId: org?.organization_id ?? null,
    agencyName: org?.organization_name ?? null,
    canView,
    canEdit: canView && canCategory("agency_settings", "edit"),
    isLoading,
  };
}

/** The open Questions count, fetched only for people who can see Questions. */
export function useOpenQuestionCount(orgId: string | null, enabled: boolean) {
  const fn = useServerFn(countOpenNectarQuestions);
  return useQuery({
    queryKey: nectarKey(orgId, "questions", "count"),
    enabled: enabled && !!orgId,
    queryFn: () => fn({ data: { organizationId: orgId! } }),
    staleTime: 60_000,
    retry: retryUnlessRefused,
  });
}

export function useNectarQuestions(orgId: string, filter: QuestionFilter) {
  const fn = useServerFn(listNectarQuestions);
  return useQuery({
    queryKey: nectarKey(orgId, "questions", filter),
    queryFn: () => fn({ data: { organizationId: orgId, filter } }),
    retry: retryUnlessRefused,
  });
}

export function useSetQuestionStatus(orgId: string) {
  const fn = useServerFn(setNectarQuestionStatus);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { questionId: string; status: QuestionStatus }) =>
      fn({ data: { organizationId: orgId, ...v } }),
    onError: (e) => toast.error(safeErrorMessage(e, "Could not update the question.")),
    onSettled: () => qc.invalidateQueries({ queryKey: nectarKey(orgId, "questions") }),
  });
}

export function useNectarSettings(orgId: string) {
  const fn = useServerFn(getNectarSettings);
  return useQuery({
    queryKey: nectarKey(orgId, "settings"),
    queryFn: () => fn({ data: { organizationId: orgId } }),
    retry: retryUnlessRefused,
  });
}

export function useSaveNectarSettings(orgId: string) {
  const fn = useServerFn(saveNectarSettings);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NectarSettings>) =>
      fn({ data: { organizationId: orgId, ...patch } }),
    onSuccess: (settings) => {
      qc.setQueryData(nectarKey(orgId, "settings"), settings);
      toast.success("AI settings saved.");
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save the AI settings.")),
    onSettled: () => qc.invalidateQueries({ queryKey: nectarKey(orgId, "ask-status") }),
  });
}
