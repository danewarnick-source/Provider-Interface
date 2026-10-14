// A state rule section Nectar cited, read-only, in team member Nectar (N6,
// Decision 7): the state contract's words the answer came from.

import { formatDay, STATE_RULE_VIEW_NOTE } from "@/lib/nectar/library/knowledge-view";
import { BackButton, StaffError, StaffLoading, StaffScroll } from "./staff-parts";
import { useStateRuleSection } from "./use-staff-policies";

export function StaffSectionView({
  orgId,
  sectionId,
  onBack,
}: {
  orgId: string | null;
  sectionId: string;
  onBack: () => void;
}) {
  const q = useStateRuleSection(orgId, sectionId);
  const data = q.data;
  return (
    <StaffScroll>
      <BackButton onBack={onBack} />
      {q.isLoading || !orgId ? (
        <StaffLoading />
      ) : q.error || !data ? (
        <StaffError error={q.error} fallback="This part of the state rules isn't available." />
      ) : (
        <article className="space-y-3 pb-2">
          <header className="space-y-0.5">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--hive-text)]">
              {data.rule.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              State rules · v{data.rule.version}
              {data.rule.effective_from
                ? ` · Effective ${formatDay(data.rule.effective_from)}`
                : ""}
            </p>
          </header>
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            {STATE_RULE_VIEW_NOTE}
          </p>
          <section className="space-y-1 rounded-xl border border-border bg-card p-3">
            {data.section.heading ? (
              <h3 className="font-semibold text-[var(--hive-text)]">{data.section.heading}</h3>
            ) : null}
            <p className="whitespace-pre-line text-sm leading-relaxed">{data.section.body}</p>
          </section>
        </article>
      )}
    </StaffScroll>
  );
}
