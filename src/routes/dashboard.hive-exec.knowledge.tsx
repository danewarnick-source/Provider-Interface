import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeArticles } from "@/components/hive-exec/knowledge-articles";
import { StateRulesSection } from "@/components/knowledge/state-rules-exec";
import { RequireCapability } from "@/hooks/use-exec-capability";

export const Route = createFileRoute("/dashboard/hive-exec/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge Base — Executive Command Center" }] }),
  component: () => (
    <RequireCapability cap="knowledge.manage">
      <div className="space-y-8">
        <KnowledgeArticles />
        <StateRulesSection />
      </div>
    </RequireCapability>
  ),
});
