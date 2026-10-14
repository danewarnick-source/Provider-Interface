import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { useCompliancePacket } from "@/hooks/use-compliance-packet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgencyDocumentsCards } from "@/components/agency-documents/agency-documents-cards";
import { PacketNextActionCard } from "@/components/compliance/packet-next-action";
import { SowIndexPanel } from "@/components/compliance/sow-index-panel";
import { isAdminLevel } from "@/lib/access/levels";
import type { AgencyFileSubTab } from "@/lib/compliance-nav";

export function AgencyFilePanel({
  agencyTab,
  onAgencyTabChange,
}: {
  agencyTab: AgencyFileSubTab;
  onAgencyTabChange: (tab: AgencyFileSubTab) => void;
}) {
  const { data: org, isLoading } = useCurrentOrg();
  const packetQ = useCompliancePacket(org?.organization_id, "agency");

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!org) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Select an organization to open the agency file.
      </div>
    );
  }

  const canAccess = isAdminLevel(org.access.level);
  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        You do not have permission to view the agency file.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--hive-gold)]/30 bg-gradient-to-br from-[#fff7ed] via-white to-white p-5 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-xl font-bold tracking-tight text-[var(--hive-text)]">
          Agency file
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Org-wide standing flags and encoded DSPD / Practice Audit policies. One card per duty;
          renew files the same card. Your agency's own policies live in the Knowledge base. Practice
          audit reuses Internal Audit — this is not a fourth audit product.
        </p>
      </div>
      <PacketNextActionCard
        nextAction={packetQ.data?.packet.nextAction}
        emptyLabel="No open agency-file action."
      />
      {/* Old ?tab=company-policies links land on the Agency file, next to the Knowledge base link (N4). */}
      <Tabs
        value={agencyTab === "contract-index" ? "contract-index" : "documents"}
        onValueChange={(v) =>
          onAgencyTabChange(v === "contract-index" ? "contract-index" : "documents")
        }
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <TabsList className="h-auto">
            <TabsTrigger value="documents">Agency file</TabsTrigger>
            <TabsTrigger value="contract-index">Agency Contract</TabsTrigger>
          </TabsList>
          <Link
            to="/dashboard/hub/knowledge"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--hive-text)] underline-offset-4 hover:underline"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Agency policies are in the Knowledge base
          </Link>
        </div>
        <TabsContent value="documents" className="mt-4">
          <AgencyDocumentsCards
            organizationId={org.organization_id}
            hiddenKeys={packetQ.data?.hiddenAgencyCards ?? []}
          />
        </TabsContent>
        <TabsContent value="contract-index" className="mt-4">
          <SowIndexPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
