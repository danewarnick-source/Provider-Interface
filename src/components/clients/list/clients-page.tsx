import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Contact2, Loader2, UserPlus } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
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
import { ImportClientsDialog } from "@/components/clients/add/import-clients-dialog";
import { ClientListCards } from "./client-list-cards";
import { ClientListTable } from "./client-list-table";
import type { ClientListViewProps } from "./client-list-types";
import { downloadClientCsv } from "./export-csv";
import { ListToolbar } from "./list-toolbar";
import { ListViewTabs, type PageView } from "./list-view-tabs";
import { useClientList } from "./use-client-list";

const NO_FILTERS: ListFilters = {
  view: "active",
  search: "",
  code: null,
  homeId: null,
  staffId: null,
};

export function ClientsPage({
  startWithAddOpen = false,
  startView = "active",
}: {
  startWithAddOpen?: boolean;
  startView?: PageView;
}) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const { status: setupStatus } = useAgencySetup();
  const createBlocked = shouldBlockStaffClientCreate(setupStatus);
  const { can, canCategory } = useAccess();
  const canEditClients = can("edit_client_records");
  const navigate = useNavigate();
  const [view, setView] = useState<PageView>(startView);
  const [filters, setFilters] = useState<ListFilters>(NO_FILTERS);
  const [addOpen, setAddOpen] = useState(startWithAddOpen);
  const [importOpen, setImportOpen] = useState(false);
  const listView = view === "discharged" ? "discharged" : "active";
  const { query, reactivate } = useClientList(orgId, { ...filters, view: listView });
  const data = query.data;
  const rows = data?.rows ?? [];
  const filtering = !!(filters.search.trim() || filters.code || filters.homeId || filters.staffId);

  const viewProps: ClientListViewProps = {
    rows,
    discharged: listView === "discharged",
    canEditClients,
    viewer: {
      canMedical: canCategory("client_medical"),
      canBilling: canCategory("billing"),
      canEditClients: canCategory("clients", "edit"),
      canEditBilling: canCategory("billing", "edit"),
      canEditTeam: canCategory("staff_roster", "edit"),
    },
    reactivate,
    onOpenClient: (clientId) =>
      navigate({ to: "/dashboard/clients/$clientId", params: { clientId }, search: {} }),
  };

  return (
    <AgencySetupCreateGate>
      <div className="space-y-5">
        <OnboardingReturnBar />
        <OnboardingGuidanceBanner step={3} />

        <SectionCard
          icon={Contact2}
          title="Clients"
          description="Everyone your agency serves. Click a name to open their profile."
          actions={
            <>
              {data?.counts ? (
                <StatusTag testId="active-client-count">
                  {data.counts.active} active client{data.counts.active === 1 ? "" : "s"}
                </StatusTag>
              ) : null}
              {canEditClients && (
                <Button
                  disabled={createBlocked}
                  data-testid="add-client-button"
                  onClick={() => setAddOpen(true)}
                >
                  <UserPlus className="h-4 w-4" /> Add client
                </Button>
              )}
            </>
          }
        />

        <ListToolbar
          tabs={
            <ListViewTabs
              view={view}
              onChange={setView}
              counts={data?.counts}
              showReferrals={!!data?.hasReferrals || view === "referrals"}
            />
          }
          showFilters={view !== "referrals"}
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          codeOptions={data?.codeOptions ?? []}
          homes={data?.homes ?? []}
          staffOptions={data?.staffOptions ?? []}
          exportDisabled={!rows.length}
          onExport={() => downloadClientCsv(rows, listView)}
        />

        {view === "referrals" ? (
          <RequirePermission perm="view_referrals">
            <ReferralsPage />
          </RequirePermission>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-hive-border bg-hive-surface">
              {query.isLoading ? (
                <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading clients...
                </div>
              ) : query.isError ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Something went wrong loading clients. {(query.error as Error).message}
                </div>
              ) : !rows.length ? (
                <div className="p-4">
                  <EmptyState
                    action={
                      filtering ? (
                        <Button variant="outline" onClick={() => setFilters(NO_FILTERS)}>
                          Clear search and filters
                        </Button>
                      ) : listView === "active" && canEditClients ? (
                        <Button disabled={createBlocked} onClick={() => setAddOpen(true)}>
                          <UserPlus className="h-4 w-4" /> Add client
                        </Button>
                      ) : null
                    }
                  >
                    {filtering
                      ? "No clients match your search and filters."
                      : listView === "discharged"
                        ? "No discharged clients."
                        : "No clients yet. Add your first client to get started."}
                  </EmptyState>
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
          <>
            <AddClientSheet
              organizationId={orgId}
              open={addOpen}
              homes={data?.homes ?? []}
              onOpenChange={setAddOpen}
              onImportSpreadsheet={() => setImportOpen(true)}
            />
            <ImportClientsDialog
              organizationId={orgId}
              open={importOpen}
              homes={data?.homes ?? []}
              onOpenChange={setImportOpen}
            />
          </>
        )}
      </div>
    </AgencySetupCreateGate>
  );
}
