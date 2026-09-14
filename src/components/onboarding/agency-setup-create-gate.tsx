import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAgencySetup } from "@/hooks/use-agency-setup";
import {
  isSetupGatedPath,
  setupRedirectForPath,
  shouldBlockStaffClientCreate,
} from "@/lib/agency-setup-gate";
import { AgencySetupIncompleteCard } from "@/components/onboarding/agency-setup-incomplete";

export function AgencySetupCreateGate({ children }: { children: React.ReactNode }) {
  const { data: org } = useCurrentOrg();
  const { status, isLoading } = useAgencySetup();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!org || isLoading) return;
    const redirect = setupRedirectForPath(pathname, status);
    if (!redirect) return;
    void navigate({ to: redirect.to, search: redirect.search, replace: true });
  }, [org, isLoading, pathname, status, navigate]);

  if (!org) {
    return <p className="text-sm text-muted-foreground">Select an organization to continue.</p>;
  }
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Checking agency setup…</p>;
  }
  if (shouldBlockStaffClientCreate(status) && isSetupGatedPath(pathname)) {
    return <AgencySetupIncompleteCard status={status} />;
  }
  return <>{children}</>;
}
