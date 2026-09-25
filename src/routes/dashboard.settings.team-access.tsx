import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { useIsHiveExecutive } from "@/hooks/use-hive-executive";
import { MembersPanel } from "@/components/access/members-panel";
import { PresetsPanel } from "@/components/access/presets-panel";
import { ChangeLogPanel } from "@/components/access/change-log-panel";
import { StaffGroupsPanel } from "@/components/settings/staff-groups-panel";

export const Route = createFileRoute("/dashboard/settings/team-access")({
  head: () => ({ meta: [{ title: "Access & presets — Provider Interface" }] }),
  component: AccessPage,
});

function AccessPage() {
  const { data: org } = useCurrentOrg();
  const { isOwner, isLoading } = useAccess();
  const { isExecutive: isHiveExec } = useIsHiveExecutive();
  const canManage = isOwner || isHiveExec;

  if (isLoading || !org) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!canManage) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Only Owners can manage access.
      </div>
    );
  }
  const orgId = org.organization_id;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Access &amp; presets</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone is an Owner, Admin, or Team member. Admins and Team members get a preset — a named set of Off / View / Edit
          settings — and can be limited to the homes, team members, and clients they&apos;re assigned.
        </p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <MembersPanel orgId={orgId} isHiveExec={isHiveExec} />
        </TabsContent>
        <TabsContent value="presets">
          <PresetsPanel orgId={orgId} canEdit={canManage} />
        </TabsContent>
        <TabsContent value="groups">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <StaffGroupsPanel orgId={orgId} />
          </div>
        </TabsContent>
        <TabsContent value="history">
          <ChangeLogPanel orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
