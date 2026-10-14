// One policy, read-only, in team member Nectar (N6, as in the demo): its
// sections and the Mark as reviewed button, or "You reviewed version N on
// <date>". Opened from the Policies tab or from a source chip in an answer.

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noSectionsNote } from "@/lib/nectar/library/knowledge-view";
import { policyMeta, reviewedText } from "@/lib/nectar/library/staff-policies";
import { BackButton, StaffError, StaffLoading, StaffScroll } from "./staff-parts";
import { useMarkReviewed, usePolicy } from "./use-staff-policies";

export function StaffPolicyView({
  orgId,
  documentId,
  onBack,
}: {
  orgId: string | null;
  documentId: string;
  onBack: () => void;
}) {
  const q = usePolicy(orgId, documentId);
  const mark = useMarkReviewed(orgId);
  const policy = q.data;
  return (
    <StaffScroll>
      <BackButton onBack={onBack} />
      {q.isLoading || !orgId ? (
        <StaffLoading />
      ) : q.error || !policy ? (
        <StaffError error={q.error} fallback="This policy isn't available." />
      ) : (
        <article className="space-y-3 pb-2">
          <header className="space-y-0.5">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--hive-text)]">
              {policy.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {policyMeta(policy.group, policy.version)}
            </p>
          </header>
          {policy.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">{noSectionsNote(null)}</p>
          ) : (
            policy.sections.map((s) => (
              <section
                key={s.position}
                className="space-y-1 rounded-xl border border-border bg-card p-3"
              >
                {s.heading ? (
                  <h3 className="font-semibold text-[var(--hive-text)]">{s.heading}</h3>
                ) : null}
                <p className="whitespace-pre-line text-sm leading-relaxed">{s.body}</p>
              </section>
            ))
          )}
          {policy.fileUrl ? (
            <a
              href={policy.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-semibold text-[var(--hive-gold)] underline underline-offset-2"
            >
              Open the file
            </a>
          ) : null}
          {policy.reviewable && policy.reviewedAt ? (
            <p className="rounded-xl bg-[var(--hive-ok-soft)] p-3 text-center text-sm font-bold text-[var(--hive-ok-fg)]">
              {reviewedText(policy.version, policy.reviewedAt)}
            </p>
          ) : null}
          {policy.reviewable && !policy.reviewedAt ? (
            <Button
              className="min-h-[48px] w-full text-base"
              disabled={mark.isPending}
              onClick={() => mark.mutate(policy.id)}
            >
              {mark.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Mark as reviewed
            </Button>
          ) : null}
        </article>
      )}
    </StaffScroll>
  );
}
