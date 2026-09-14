import { useAgencySetup } from "@/hooks/use-agency-setup";

/**
 * Compatibility shim. Setup completion / create unlock is ONLY
 * `useAgencySetup` + the six saved operating facts.
 *
 * This hook does not read browser storage, does not write company-profile
 * drafts, and does not compute a staff/client/codes checklist as
 * eligibility. Callers that need setup state should use useAgencySetup.
 */
export function useOnboardingProgress() {
  const { orgId, status, refetch } = useAgencySetup();
  return {
    orgId,
    counts: {
      memberCount: 0,
      clientCount: 0,
      serviceCodeCount: 0,
      serviceCodesCount: 0,
      docsCount: 0,
      profileSaved: false,
      welcomeDismissedAt: null as string | null,
    },
    steps: {
      1: false,
      2: false,
      3: false,
      4: false,
    },
    step1Complete: false,
    servicesVisited: false,
    completedCount: status.answeredCount,
    totalSteps: status.requiredCount,
    allComplete: status.complete,
    dismissed: false,
    onboardingActive: !!orgId && !status.complete,
    refetch,
  };
}
