import { createFileRoute } from "@tanstack/react-router";
import { EvidenceWorkspace } from "@/components/evidence/evidence-workspace";
import {
  evidenceSearchFor,
  parseEvidenceSearch,
  resolveEvidenceStep,
  resolveEvidenceTab,
} from "@/lib/evidence/nav.ts";

export const Route = createFileRoute("/dashboard/evidence")({
  head: () => ({ meta: [{ title: "Evidence — Provider Interface" }] }),
  validateSearch: parseEvidenceSearch,
  component: EvidencePage,
});

function EvidencePage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const tab = resolveEvidenceTab(search.tab);
  const step = resolveEvidenceStep(search.step);

  return (
    <EvidenceWorkspace
      tab={tab}
      step={search.wizard ? "quiz" : step}
      personId={search.person}
      itemId={search.item}
      wizard={search.wizard}
      onSearchChange={(next) => {
        void navigate({
          search: evidenceSearchFor({
            tab: next.tab ?? tab,
            step: next.step ?? step,
            person: next.person === undefined ? search.person : next.person,
            item: next.item === undefined ? search.item : next.item,
            wizard: next.wizard,
          }),
        });
      }}
    />
  );
}
