import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Contact2, Loader2, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { OnboardingGuidanceBanner } from "@/components/onboarding/onboarding-guidance-banner";
import { OnboardingReturnBar } from "@/components/onboarding/onboarding-return-bar";
import { ReferralsPage } from "@/components/referrals/referrals-page";
import { RequirePermission } from "@/components/rbac-guard";
import { useAccess } from "@/hooks/use-access";
import { useAgencySetup } from "@/hooks/use-agency-setup";
import { useCurrentOrg } from "@/hooks/use-org";
import { shouldBlockStaffClientCreate } from "@/lib/agency-setup-gate";
import type { ListFilters } from "@/lib/clients/list";
import { AddClientSheet } from "@/components/clients/add/add-client-sheet";
import { ClientListCards } from "./client-list-cards";
import { ClientListTable } from "./client-list-table";
import type { ClientListViewProps } from "./client-list-types";
import { downloadClientCsv } from "./export-csv";
import { ListToolbar } from "./list-toolbar";
import { ListViewTabs, type PageView } from "./list-view-tabs";
import { useClientList } from "./use-client-list";

export function ClientsPage({
  startWithAddOpen = false,
  startDraftId = null,
  startView = "active",
}: {
  startWithAddOpen?: boolean;
  startDraftId?: string | null;
  startView?: PageView;
}) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const { status: setupStatus } = useAgencySetup();
  const createBlocked = shouldBlockStaffClientCreate(setupStatus);
  const { can } = useAccess();
  const canEditClients = can("edit_client_records");
  const navigate = useNavigate();
  const [view, setView] = useState<PageView>(startView);
  const [filters, setFilters] = useState<ListFilters>({
    view: "active",
    search: "",
    code: null,
    homeId: null,
    staffId: null,
  });
  const [add, setAdd] = useState<{ open: boolean; draftId: string | null }>({
    open: startWithAddOpen || !!startDraftId,
    draftId: startDraftId,
  });
  const listView = view === "discharged" ? "discharged" : "active";
  const { query, reactivate } = useClientList(orgId, { ...filters, view: listView });
  const data = query.data;
  const rows = data?.rows ?? [];
  const filtering = !!(filters.search.trim() || filters.code || filters.homeId || filters.staffId);

  const viewProps: ClientListViewProps = {
    rows,
    discharged: listView === "discharged",
    canEditClients,
    reactivate,
    onOpenClient: (clientId) =>
      navigate({
        to: "/dashboard/clients/$clientId",
        params: { clientId },
        search: { tab: "overview" },
      }),
    onOpenDraft: (draftId) => setAdd({ open: true, draftId }),
  };

  return (
    <AgencySetupCreateGate>
      <div className="space-y-5">
        <OnboardingReturnBar />
        <OnboardingGuidanceBanner step={3} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl self-center">
            <h2 className="sr-only">Client Directory</h2>
            <p className="text-sm text-muted-foreground">
              Everyone your agency serves, their codes, homes and what's due next.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditClients && (
              <>
                <Button
                  asChild
                  variant="outline"
                >
                  <Link to="/dashboard/smart-import" search={{ mode: "client" }}>
                    <Sparkles className="h-4 w-4" /> Import clients
                  </Link>
                </Button>
                <Button
                  disabled={createBlocked}
                  data-testid="add-client-button"
                  onClick={() => setAdd({ open: true, draftId: null })}
                >
                  <UserPlus className="h-4 w-4" /> Add client
                </Button>
              </>
            )}
          </div>
        </div>

        <ListViewTabs
          view={view}
          onChange={setView}
          counts={data?.counts}
          showReferrals={!!data?.hasReferrals || view === "referrals"}
        />

        {view === "referrals" ? (
          <RequirePermission perm="view_referrals">
            <ReferralsPage />
          </RequirePermission>
        ) : (
          <>
            <ListToolbar
              filters={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              codeOptions={data?.codeOptions ?? []}
              homes={data?.homes ?? []}
              staffOptions={data?.staffOptions ?? []}
              exportDisabled={!rows.length}
              onExport={() =>
                downloadClientCsv(
                  rows.filter((r) => r.kind === "client"),
                  listView,
                )
              }
            />
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {query.isLoading ? (
                <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading clients...
                </div>
              ) : query.isError ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Something went wrong loading clients. {(query.error as Error).message}
                </div>
              ) : !rows.length ? (
                <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
                  <Contact2 className="h-8 w-8 text-muted-foreground/40" />
                  <p>
                    {filtering
                      ? "No clients match your search."
                      : listView === "discharged"
                        ? "No discharged clients."
                        : "No clients yet. Add your first client to get started."}
                  </p>
                </div>
              ) : (
                <>
                  <ClientListCards {...viewProps} />
                  <ClientListTable {...viewProps} />
                </>
              )}
            </div>
          </>
        )}

        {orgId && (
          <AddClientSheet
            organizationId={orgId}
            open={add.open}
            draftId={add.draftId}
            homes={data?.homes ?? []}
            onOpenChange={(open) => setAdd((a) => ({ open, draftId: open ? a.draftId : null }))}
          />
        )}
      </div>
    </AgencySetupCreateGate>
  );
}
