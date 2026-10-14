import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  knowledgeView,
  KNOWLEDGE_TABS,
  type KnowledgeTab,
} from "@/lib/nectar/library/knowledge-nav";
import { missingCount } from "@/lib/nectar/library/knowledge-view";
import { cn } from "@/lib/utils";
import { DocumentView } from "./document-view";
import { KnowledgeLoading, KnowledgeNoAccess } from "./knowledge-states";
import { LibraryTab } from "./library-tab";
import { NewDocument } from "./new-document";
import { RequiredTab } from "./required-tab";
import { ReviewsTab } from "./reviews-tab";
import { StateRuleView } from "./state-rule-view";
import {
  useKnowledgeAccess,
  useKnowledgeNav,
  useKnowledgeSearch,
  useRequiredPolicies,
} from "./use-knowledge";

/**
 * The admin Knowledge base (N4, matching the demo): Library, Required policies
 * and Reviews; a document, a state rule or New document opens from the URL's
 * search params (knowledge-nav.ts).
 */
export function KnowledgePage() {
  const { orgId, canView, canEdit, isLoading } = useKnowledgeAccess();
  const search = useKnowledgeSearch();
  if (isLoading) return <KnowledgeLoading />;
  if (!canView || !orgId) return <KnowledgeNoAccess />;
  const view = knowledgeView(search);
  if (view.kind === "new") {
    if (!canEdit) return <KnowledgeNoAccess need="edit" />;
    return <NewDocument orgId={orgId} slot={view.slot} question={view.question} />;
  }
  if (view.kind === "document") {
    return <DocumentView orgId={orgId} documentId={view.id} canEdit={canEdit} />;
  }
  if (view.kind === "state_rule") return <StateRuleView orgId={orgId} stateRuleId={view.id} />;
  return <KnowledgeHome orgId={orgId} tab={view.tab} canEdit={canEdit} />;
}

function KnowledgeHome({
  orgId,
  tab,
  canEdit,
}: {
  orgId: string;
  tab: KnowledgeTab;
  canEdit: boolean;
}) {
  const nav = useKnowledgeNav();
  const required = useRequiredPolicies(orgId);
  const missing = required.data ? missingCount(required.data.rows) : null;
  return (
    <div>
      <PageHeader
        title="Knowledge base"
        description="Your agency's policies, procedures and the state rules. Nectar answers only from what's published here."
        actions={
          canEdit ? (
            <Button data-tour="authsources.upload" onClick={() => nav.newDocument()}>
              <Plus aria-hidden="true" /> New document
            </Button>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if ((KNOWLEDGE_TABS as readonly string[]).includes(v)) nav.home(v as KnowledgeTab);
        }}
      >
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="required">
            Required policies
            {missing !== null ? (
              <span
                className={cn(
                  "ml-1.5",
                  missing > 0 ? "text-[var(--hive-danger-fg)]" : "text-muted-foreground",
                )}
              >
                ({missing} missing)
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-5">
          <LibraryTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="required" className="mt-5">
          <RequiredTab orgId={orgId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="reviews" className="mt-5">
          <ReviewsTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
