import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";

function lsKey(orgId: string, suffix: string) {
  return `hive_onboarding_${orgId}_${suffix}`;
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const ONBOARDING_CHANGED_EVENT = "nectar-onboarding-changed";

export function notifyOnboardingChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
}

/**
 * Shared onboarding completion source-of-truth used by the NECTAR
 * onboarding panel, the persistent return bar, and the per-page guidance
 * banners. Required steps: agency profile, staff, clients, service codes.
 * Company documents are optional evidence storage. Statewide SOW upload
 * is not an onboarding gate.
 */
export function useOnboardingProgress() {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;

  const [profileSaved, setProfileSaved] = useState(false);
  const [servicesVisited, setServicesVisited] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    const sync = () => {
      setProfileSaved(readLS(lsKey(orgId, "profile_saved"), false));
      setServicesVisited(readLS(lsKey(orgId, "services_visited"), false));
    };
    sync();
    // Re-read on focus / same-tab writes so completion flips immediately
    // after returning from a destination page that just wrote a flag.
    window.addEventListener("focus", sync);
    window.addEventListener(ONBOARDING_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener(ONBOARDING_CHANGED_EVENT, sync);
    };
  }, [orgId]);

  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["nectar-onboarding-progress", orgId],
    queryFn: async (): Promise<{
      memberCount: number;
      clientCount: number;
      serviceCodeCount: number;
      serviceCodesCount: number;
      docsCount: number;
      profileSaved: boolean;
      welcomeDismissedAt: string | null;
    }> => {
      const [members, clients, codes, allDocs, activeCodes, orgProfile] = await Promise.all([
        (supabase as any)
          .from("organization_members")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", orgId!),
        (supabase as any)
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!),
        (supabase as any)
          .from("service_codes")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!),
        (supabase as any)
          .from("nectar_documents")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!),
        (supabase as any)
          .from("service_codes")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("is_active", true),
        (supabase as any)
          .from("organizations")
          .select("nectar_profile_saved_at, welcome_dismissed_at")
          .eq("id", orgId!)
          .maybeSingle(),
      ]);
      return {
        memberCount: members.count ?? 0,
        clientCount: clients.count ?? 0,
        serviceCodeCount: codes.count ?? 0,
        serviceCodesCount: activeCodes.count ?? 0,
        docsCount: allDocs.count ?? 0,
        profileSaved: !!(orgProfile.data as any)?.nectar_profile_saved_at,
        welcomeDismissedAt: ((orgProfile.data as any)?.welcome_dismissed_at as string | null) ?? null,
      };
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const c = q.data ?? {
    memberCount: 0,
    clientCount: 0,
    serviceCodeCount: 0,
    serviceCodesCount: 0,
    docsCount: 0,
    profileSaved: false,
    welcomeDismissedAt: null,
  };

  const steps = {
    1: c.profileSaved || profileSaved,
    2: c.memberCount > 1,
    3: c.clientCount > 0,
    4: c.serviceCodesCount > 0,
  } as const;

  const completedCount = Object.values(steps).filter(Boolean).length;
  const totalSteps = 4;
  const allComplete = completedCount === totalSteps;
  const dismissed = !!c.welcomeDismissedAt;

  return {
    orgId,
    counts: c,
    steps,
    step1Complete: steps[1],
    servicesVisited,
    completedCount,
    totalSteps,
    allComplete,
    dismissed,
    /** True when the persistent return bar / guidance should appear at all. */
    onboardingActive: !!orgId && !allComplete && !dismissed,
    refetch: q.refetch,
  };
}

export { lsKey as onboardingLSKey };
