// A team member's policies (N6, Decision 4): their Policies list, one policy
// to read, "Mark as reviewed", and a state rule section Nectar cited. The
// server checks the membership on every call and returns only what is
// published and meant for this person.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getPolicyForReview,
  getStaffReviewRecord,
  getStateRuleSection,
  markPolicyReviewed,
} from "@/lib/nectar/library/library.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { nectarKey } from "../use-ask-nectar";

const NOT_FOUND = /not found|isn't meant for you|not a member/i;

/** Don't retry a policy or section that isn't there (or isn't for them). */
function retryUnlessGone(failures: number, error: unknown): boolean {
  return failures < 1 && !NOT_FOUND.test(safeErrorMessage(error, ""));
}

/** Every published policy and procedure meant for the caller, with their review of each. */
export function useMyPolicies(orgId: string | null) {
  const fn = useServerFn(getStaffReviewRecord);
  return useQuery({
    queryKey: nectarKey(orgId, "my-policies"),
    enabled: !!orgId,
    queryFn: () => fn({ data: { organizationId: orgId! } }),
    retry: retryUnlessGone,
  });
}

export function usePolicy(orgId: string | null, documentId: string) {
  const fn = useServerFn(getPolicyForReview);
  return useQuery({
    queryKey: nectarKey(orgId, "policy", documentId),
    enabled: !!orgId,
    queryFn: () => fn({ data: { organizationId: orgId!, documentId } }),
    retry: retryUnlessGone,
  });
}

export function useStateRuleSection(orgId: string | null, sectionId: string) {
  const fn = useServerFn(getStateRuleSection);
  return useQuery({
    queryKey: nectarKey(orgId, "state-section", sectionId),
    enabled: !!orgId,
    queryFn: () => fn({ data: { organizationId: orgId!, sectionId } }),
    retry: retryUnlessGone,
    staleTime: 10 * 60_000,
  });
}

/** "Mark as reviewed": a dated record of this person reviewing this version. */
export function useMarkReviewed(orgId: string | null) {
  const fn = useServerFn(markPolicyReviewed);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => fn({ data: { organizationId: orgId!, documentId } }),
    onSuccess: () => toast.success("Marked as reviewed."),
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save your review.")),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: nectarKey(orgId, "my-policies") }),
        qc.invalidateQueries({ queryKey: nectarKey(orgId, "policy") }),
        qc.invalidateQueries({ queryKey: ["knowledge", orgId] }),
      ]),
  });
}
