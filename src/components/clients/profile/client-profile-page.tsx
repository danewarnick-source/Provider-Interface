// Client profile — the page body behind /dashboard/clients/$clientId.
// Side-menu sections (?section=), header with the ⋯ menu, and the one
// needs-attention list (lib/clients/readiness.ts) feeding Overview and the
// menu badges. A discharged client's sections are read-only, with the
// discharge card on top. A newly added client shows "Finish setting up"
// (setup/client-setup.tsx; ?setup=open opens the steps).

import { useEffect, useRef } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { RecordReadOnlyProvider } from "@/hooks/use-record-read-only";
import { useCurrentOrg } from "@/hooks/use-org";
import { isRouteUuid } from "@/lib/route-uuid";
import { recordPhiAccess } from "@/lib/phi-access-audit.functions";
import { getClientOverview } from "@/lib/clients/overview.functions";
import { clientOverviewKey } from "@/lib/clients/overview";
import { attentionBySection } from "@/lib/clients/readiness";
import {
  clientSectionSearchValue,
  resolveClientSection,
  visibleClientSections,
  type ClientProfileSection,
} from "@/lib/clients/profile-sections";
import { SectionCard } from "./cards/section-card";
import { ClientProfileShell } from "./profile-shell";
import { ClientProfileHeader, isDischarged } from "./profile-header";
import { DischargeCard } from "./discharge/discharge-card";
import { SectionBody } from "./section-body";
import { useClientProfile } from "./use-client-profile";
import { useClientMoneyPresence } from "./money/use-client-money";
import { ClientSetup } from "./setup/client-setup";

const profileRoute = getRouteApi("/dashboard/clients/$clientId");

export function ClientProfilePage() {
  const { clientId } = profileRoute.useParams();
  const { section, setup } = profileRoute.useSearch();
  const navigate = profileRoute.useNavigate();
  const { data: org, isLoading: orgLoading } = useCurrentOrg();
  const { canCategory } = useAccess();
  const qc = useQueryClient();
  const orgId = org?.organization_id;
  const overviewFn = useServerFn(getClientOverview);
  const auditFn = useServerFn(recordPhiAccess);
  const audited = useRef(false);

  const profileQ = useClientProfile(orgId, clientId);
  const overviewQ = useQuery({
    enabled: !!orgId && isRouteUuid(clientId) && !!profileQ.data,
    queryKey: clientOverviewKey(orgId, clientId),
    queryFn: () => overviewFn({ data: { organizationId: orgId!, clientId } }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!orgId || !profileQ.data || audited.current) return;
    audited.current = true;
    void auditFn({
      data: {
        organizationId: orgId,
        resourceType: "client_chart",
        resourceId: clientId,
        clientId,
        action: "view",
        detail: "admin-client-profile-hub",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    });
  }, [orgId, clientId, profileQ.data, auditFn]);

  // Any save on this page refreshes the Overview (attention, units, team).
  useEffect(() => {
    if (!orgId) return;
    return qc.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        void qc.invalidateQueries({ queryKey: clientOverviewKey(orgId, clientId) });
      }
    });
  }, [qc, orgId, clientId]);

  const canBilling = canCategory("billing");
  const moneyQ = useClientMoneyPresence(orgId, clientId, profileQ.data?.codes ?? [], canBilling);
  const viewer = {
    canMedical: canCategory("client_medical"),
    canBilling,
    hasMoney: moneyQ.data === true,
  };
  const visible = visibleClientSections(viewer);
  const active = resolveClientSection(section, viewer);

  if (orgLoading || (orgId && profileQ.isLoading)) {
    return <div className="p-6 text-sm text-muted-foreground">Loading client…</div>;
  }
  if (!orgId || !profileQ.data) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <SectionCard
          icon={ShieldAlert}
          tone="danger"
          title={profileQ.isError ? "Couldn't load this client" : "Client not found"}
          description={
            profileQ.isError
              ? "Something went wrong loading the profile. Please try again."
              : "This client isn't in your agency."
          }
          testId="client-profile-not-found"
          actions={
            <Button variant="outline" asChild>
              <Link to="/dashboard/clients">Back to Clients</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const data = profileQ.data;
  const discharged = isDischarged(data.client.account_status);
  const attention = overviewQ.data?.attention ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["client-profile"] });
    void qc.invalidateQueries({ queryKey: clientOverviewKey(orgId, clientId) });
  };
  const select = (next: ClientProfileSection) =>
    // Sections replace the entry: Back leaves the profile in one step.
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, section: clientSectionSearchValue(next) }),
    });

  return (
    <div
      className="container mx-auto min-w-0 max-w-7xl overflow-x-hidden px-4 py-6"
      data-testid="client-profile-page"
      data-active-section={active}
    >
      <ClientProfileShell
        header={
          <ClientProfileHeader
            orgId={orgId}
            data={data}
            attention={overviewQ.data?.attention ?? null}
            onSelect={select}
            onChanged={refresh}
          />
        }
        visible={visible}
        attentionCounts={attentionBySection(attention)}
        attentionTotal={attention.length}
        active={active}
        onSelect={select}
      >
        {discharged ? (
          <DischargeCard orgId={orgId} clientId={clientId} onChanged={refresh} />
        ) : null}
        <ClientSetup
          orgId={orgId}
          data={data}
          overview={overviewQ.data ?? null}
          open={setup === "open"}
          discharged={discharged}
          onOpenChange={(o) =>
            navigate({ replace: true, search: (prev) => ({ ...prev, setup: o ? "open" : undefined }) })
          }
          onSelect={select}
          onDraftAbout={() =>
            navigate({
              replace: true,
              search: (prev) => ({ ...prev, section: "profile", about: "draft", setup: undefined }),
            })
          }
        />
        <RecordReadOnlyProvider readOnly={discharged}>
          <SectionBody
            section={active}
            orgId={orgId}
            data={data}
            overview={overviewQ.data ?? null}
            overviewLoading={overviewQ.isLoading}
            overviewError={overviewQ.isError}
            onSelect={select}
            onChanged={refresh}
          />
        </RecordReadOnlyProvider>
      </ClientProfileShell>
    </div>
  );
}
