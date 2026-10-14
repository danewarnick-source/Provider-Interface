// One Nectar answer from askNectar (N5): the AI label, the answer with its
// numbered markers, the sources it cites, and thumbs up / down. Used by the
// admin help chat, the staff Ask chat and the audit zone until N6 rebuilds
// those screens.

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { NectarAnswer } from "@/components/nectar/nectar-answer";
import type { AskNectarResult, FeedbackValue, NectarSource } from "@/lib/nectar/engine/ask-types";
import { knowledgeHref } from "@/lib/nectar/library/knowledge-nav";

/** Where an admin opens a source: the document or state rule, or the Required policies tab. */
function sourceHref(source: NectarSource): string | null {
  if (source.documentId) return knowledgeHref({ doc: source.documentId });
  if (source.stateRuleId) return knowledgeHref({ rule: source.stateRuleId });
  if (source.kind === "agency") {
    return knowledgeHref({ tab: source.id === "agency:reviews" ? "reviews" : "required" });
  }
  return null;
}

function sourceLabel(source: NectarSource): string {
  return [source.documentTitle, source.heading, source.version ? `v${source.version}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function NectarReply({
  reply,
  linkSources = false,
  onRate,
}: {
  reply: AskNectarResult;
  /** Admins can open sources in the Knowledge base; team members see them as text (N6 adds theirs). */
  linkSources?: boolean;
  onRate?: (questionId: string, value: FeedbackValue) => Promise<unknown>;
}) {
  const [rated, setRated] = useState<FeedbackValue | null>(null);
  const questionId = reply.questionId;
  const rate = (value: FeedbackValue) => {
    if (!questionId || !onRate || rated) return;
    setRated(value);
    onRate(questionId, value).catch(() => setRated(null));
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {reply.label}
      </p>
      <NectarAnswer text={reply.answer} />
      {reply.sources.length > 0 && (
        <ol className="space-y-0.5 border-t border-border pt-1.5 text-[11px] text-muted-foreground">
          {reply.sources.map((source, i) => {
            const href = linkSources ? sourceHref(source) : null;
            const label = sourceLabel(source);
            return (
              <li key={source.id}>
                <span className="font-semibold">[{i + 1}]</span>{" "}
                {href ? (
                  <a href={href} className="text-[var(--hive-gold)] underline underline-offset-2">
                    {label}
                  </a>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ol>
      )}
      {questionId && onRate && reply.refusal !== "off" && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {rated ? (
            <span>
              {rated === "up" ? "Thanks for the feedback." : "Thanks. An admin will look at this."}
            </span>
          ) : (
            <>
              <span>Was this helpful?</span>
              <button
                type="button"
                aria-label="Helpful"
                onClick={() => rate("up")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Not helpful"
                onClick={() => rate("down")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
