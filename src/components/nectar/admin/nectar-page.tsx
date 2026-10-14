// Admin Nectar on /dashboard/help (N6, matching the demo): Ask, Questions
// (N open) and AI settings. Questions and AI settings are for people with
// Agency settings access for the whole agency (owners today); everyone else
// on this page gets Ask only. The tab comes from the URL (?tab=).

import { getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_NECTAR_TABS, type AdminNectarTab } from "@/lib/nectar/nectar-nav";
import { AdminLoading } from "./admin-states";
import { AskTab } from "./ask-tab";
import { QuestionsTab } from "./questions-tab";
import { SettingsTab } from "./settings-tab";
import { useNectarAdminAccess, useOpenQuestionCount } from "./use-nectar-admin";

const helpRoute = getRouteApi("/dashboard/help");

const NECTAR_PAGE_DESCRIPTION =
  "Nectar is an AI assistant. It answers only from your published documents, the state rules and your agency's records, and it shows where every answer came from.";

export function NectarPage() {
  const access = useNectarAdminAccess();
  const search = helpRoute.useSearch();
  const navigate = helpRoute.useNavigate();
  const count = useOpenQuestionCount(access.orgId, access.canView);
  const go = (tab: AdminNectarTab) =>
    void navigate({ search: (prev) => ({ ...prev, tab: tab === "ask" ? undefined : tab }) });

  const header = <PageHeader title="Nectar" description={NECTAR_PAGE_DESCRIPTION} />;
  if (access.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <AdminLoading />
      </div>
    );
  }
  if (!access.canView || !access.orgId) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <AskTab canSeeQuestions={false} />
      </div>
    );
  }
  const tab = search.tab ?? "ask";
  const open = count.data?.open;
  return (
    <div className="mx-auto max-w-5xl">
      {header}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if ((ADMIN_NECTAR_TABS as readonly string[]).includes(v)) go(v as AdminNectarTab);
        }}
      >
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="ask">Ask</TabsTrigger>
          <TabsTrigger value="questions">
            Questions
            {open !== undefined ? (
              <span className="ml-1.5 text-amber-800">({open} open)</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="settings">AI settings</TabsTrigger>
        </TabsList>
        <TabsContent value="ask" className="mt-5">
          <AskTab
            canSeeQuestions
            onOpenSettings={access.canEdit ? () => go("settings") : undefined}
          />
        </TabsContent>
        <TabsContent value="questions" className="mt-5">
          <QuestionsTab orgId={access.orgId} canEdit={access.canEdit} />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <SettingsTab
            orgId={access.orgId}
            agencyName={access.agencyName}
            canEdit={access.canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
