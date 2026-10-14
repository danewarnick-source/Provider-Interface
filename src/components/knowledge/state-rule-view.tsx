import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  documentChip,
  documentNote,
  formatDay,
  formatInstant,
  STATE_RULE_VIEW_NOTE,
} from "@/lib/nectar/library/knowledge-view";
import { getStateRuleDocument } from "@/lib/nectar/library/library.functions";
import { BackToKnowledge } from "./document-view";
import { DocumentSections, SidePanel, VersionsList } from "./document-sections";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import { StatusChip } from "./status-chip";
import { knowledgeKey, useKnowledgeNav } from "./use-knowledge";

/** A state rule, read-only: loaded by PI for every agency and kept current. */
export function StateRuleView({ orgId, stateRuleId }: { orgId: string; stateRuleId: string }) {
  const fn = useServerFn(getStateRuleDocument);
  const nav = useKnowledgeNav();
  const q = useQuery({
    queryKey: knowledgeKey(orgId, "rule", stateRuleId),
    queryFn: () => fn({ data: { organizationId: orgId, stateRuleId } }),
  });
  if (q.isLoading || q.error || !q.data) {
    return (
      <div className="space-y-4">
        <BackToKnowledge />
        {q.error ? <KnowledgeError error={q.error} /> : <KnowledgeLoading />}
      </div>
    );
  }
  const { rule, versions, sections } = q.data;
  const replaced = !!rule.archived_at;
  const meta = ["State rules", `v${rule.version}`, "Owner: PI"];
  if (rule.effective_from) meta.push(`Effective ${formatDay(rule.effective_from)}`);
  const note = replaced
    ? documentNote({ status: "archived", pastReview: false, superseded: true })
    : STATE_RULE_VIEW_NOTE;

  return (
    <div className="space-y-4">
      <BackToKnowledge />
      <div className="flex flex-wrap items-start gap-5">
        <article className="min-w-0 flex-[999_1_460px] space-y-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--hive-text)] sm:text-2xl">
              {rule.title}
            </h1>
            <StatusChip chip={documentChip({ kind: "state_rule", status: "published" })} />
          </div>
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
          <p className="rounded-lg bg-[var(--hive-muted-surface)] px-3 py-2 text-sm text-[var(--hive-text)]">
            {note}
          </p>
          <DocumentSections sections={sections} />
        </article>
        <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
          <SidePanel title="Versions">
            <VersionsList
              currentId={rule.id}
              onOpen={nav.openStateRule}
              versions={versions.map((v) => ({
                id: v.id,
                label: `v${v.version} · ${formatInstant(v.published_at)}`,
                note: v.archived_at
                  ? `Replaced ${formatInstant(v.archived_at)}`
                  : "Current version",
              }))}
            />
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}
