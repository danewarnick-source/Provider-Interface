import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Contact2, Loader2, MapPin, Search, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { OnboardingGuidanceBanner } from "@/components/onboarding/onboarding-guidance-banner";
import { OnboardingReturnBar } from "@/components/onboarding/onboarding-return-bar";
import { useAccess } from "@/hooks/use-access";
import { useAgencySetup } from "@/hooks/use-agency-setup";
import { useCurrentOrg } from "@/hooks/use-org";
import { shouldBlockStaffClientCreate } from "@/lib/agency-setup-gate";
import { AddClientDialog } from "@/components/clients/add/add-client-dialog";
import { useAddClient } from "@/components/clients/add/use-add-client";
import { ClientCompliancePanel } from "./client-compliance-panel";
import { ClientListCards } from "./client-list-cards";
import { ClientListTable } from "./client-list-table";
import type { ClientListViewProps, RosterTab } from "./client-list-types";
import { useClientList } from "./use-client-list";

export function ClientsPage({ startWithAddOpen = false }: { startWithAddOpen?: boolean }) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const { status: setupStatus } = useAgencySetup();
  const createBlocked = shouldBlockStaffClientCreate(setupStatus);
  const canEditClients = useAccess().can("edit_client_records");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(startWithAddOpen);
  const [rosterTab, setRosterTab] = useState<RosterTab>("active");
  const [compliancePanelClient, setCompliancePanelClient] = useState<{ id: string; name: string } | null>(null);

  const { filtered, isLoading, archivedCount, pendingClientCount, reactivate, backfillPins } =
    useClientList(orgId, rosterTab, search);
  const addMutation = useAddClient(orgId, {
    onCreated: () => setAddOpen(false),
    onDraftCreated: setCompliancePanelClient,
  });

  const viewProps: ClientListViewProps = {
    rows: filtered,
    rosterTab,
    organizationId: orgId,
    canEditClients,
    reactivate,
    onOpenClient: (clientId) =>
      navigate({ to: "/dashboard/clients/$clientId", params: { clientId }, search: { tab: "overview" } }),
    onOpenIntake: setCompliancePanelClient,
  };

  return (
    <AgencySetupCreateGate>
    <div className="space-y-5">
      <OnboardingReturnBar />
      <OnboardingGuidanceBanner step={3} />

      {pendingClientCount > 0 && (
        <Link
          to="/dashboard/clients/pending"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-2.5 text-sm hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
        >
          <span className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {pendingClientCount} imported client{pendingClientCount === 1 ? "" : "s"} need{pendingClientCount === 1 ? "s" : ""} finishing before {pendingClientCount === 1 ? "it joins" : "they join"} your directory.
          </span>
          <span className="font-medium text-amber-900 dark:text-amber-300">Review pending →</span>
        </Link>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl self-center">
          <h2 className="sr-only">Client Directory</h2>
          <p className="text-sm text-muted-foreground">
            Manage individuals served, authorized service codes, and care configurations.
          </p>
        </div>
        {canEditClients && (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="border-primary/40 text-primary hover:bg-primary/5">
            <Link to="/dashboard/smart-import" search={{ mode: "client" }}>
              <Sparkles className="mr-2 h-4 w-4" /> Import
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={backfillPins.isPending || !orgId}
            onClick={() => backfillPins.mutate()}
            title="Re-geocode addresses whose saved pin is missing or does not match. Does not invent coordinates."
          >
            {backfillPins.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <MapPin className="mr-2 h-4 w-4" />}
            Refresh home pins
          </Button>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={createBlocked} data-testid="add-client-button">
                <UserPlus className="mr-2 h-4 w-4" /> Add New Client
              </Button>
            </DialogTrigger>
            <AddClientDialog
              pending={addMutation.isPending}
              onSubmit={(v) => addMutation.mutate(v)}
            />
          </Dialog>
        </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or Medicaid ID..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Active / Archived tabs */}
      <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setRosterTab(t)}
            className={
              "rounded px-3 py-1 font-medium capitalize transition-colors " +
              (rosterTab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t}
            {t === "archived" && archivedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {archivedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading clients...
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <Contact2 className="h-8 w-8 text-muted-foreground/40" />
            <p>
              {search
                ? "No clients match your search."
                : rosterTab === "archived"
                  ? "No archived clients."
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

      {org && compliancePanelClient && (
        <ClientCompliancePanel
          open={!!compliancePanelClient}
          onOpenChange={(v) => !v && setCompliancePanelClient(null)}
          organizationId={org.organization_id}
          clientId={compliancePanelClient.id}
          clientName={compliancePanelClient.name}
        />
      )}
    </div>
    </AgencySetupCreateGate>
  );
}
