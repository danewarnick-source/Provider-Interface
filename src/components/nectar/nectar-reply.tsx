// One Nectar answer from askNectar (N5, N6 as in the demo): the AI label, the
// answer with its numbered markers, its source chips, any extra action (the
// team member's "Mark … as reviewed") and thumbs up / down. Used by admin
// Nectar, team member Nectar and the audit zone.

import { useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { NectarAnswer } from "@/components/nectar/nectar-answer";
import type { AskNectarResult, FeedbackValue, NectarSource } from "@/lib/nectar/engine/ask-types";
import { adminSourceHref, sourceLabel } from "@/lib/nectar/source-links";

const CHIP =
  "inline-flex min-h-[32px] items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-left text-xs font-semibold text-[var(--hive-text)]";

function SourceChip({ n, label, href }: { n: number; label: string; href: string | null }) {
  const navigate = useNavigate();
  const text = (
    <>
      <span className="mr-1 text-muted-foreground">[{n}]</span>
      {label}
    </>
  );
  if (!href) return <span className={CHIP}>{text}</span>;
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    void navigate({ href });
  };
  return (
    <a
      href={href}
      onClick={open}
      className={`${CHIP} hover:border-[var(--hive-gold)]/60 hover:bg-[#fff7ed]`}
    >
      {text}
    </a>
  );
}

const THUMB =
  "inline-flex h-9 w-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted";

export function NectarReply({
  reply,
  linkSources = false,
  sourceHref,
  onRate,
  rated: ratedBefore,
  notFoundNote,
  children,
}: {
  reply: AskNectarResult;
  /** Admin view: sources open in the Knowledge base (admin Nectar, audit zone). */
  linkSources?: boolean;
  /** Where each source opens (team member Nectar); wins over linkSources. */
  sourceHref?: (source: NectarSource) => string | null;
  onRate?: (questionId: string, value: FeedbackValue) => Promise<unknown>;
  /** Thumbs already given to this answer. */
  rated?: FeedbackValue;
  /** Under a "couldn't find" answer: where the question went. */
  notFoundNote?: string;
  /** Extra actions under the answer. */
  children?: ReactNode;
}) {
  const [rated, setRated] = useState<FeedbackValue | null>(ratedBefore ?? null);
  const questionId = reply.questionId;
  const hrefFor = sourceHref ?? (linkSources ? adminSourceHref : () => null);
  const canRate = reply.found && !!questionId && !!onRate;
  const rate = (value: FeedbackValue) => {
    if (!questionId || !onRate || rated) return;
    setRated(value);
    onRate(questionId, value).catch(() => setRated(null));
  };
  const showNote = !!notFoundNote && !reply.found && !reply.refusal && !!questionId;

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {reply.label}
      </p>
      <NectarAnswer text={reply.answer} />
      {showNote ? <p className="text-xs text-muted-foreground">{notFoundNote}</p> : null}
      {reply.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sources:</span>
          {reply.sources.map((source, i) => (
            <SourceChip
              key={source.id}
              n={i + 1}
              label={sourceLabel(source)}
              href={hrefFor(source)}
            />
          ))}
        </div>
      )}
      {children}
      {canRate &&
        (rated ? (
          <p className="text-xs text-muted-foreground">
            {rated === "up" ? "Thanks for the feedback." : "Thanks. Sent to your admin to review."}
          </p>
        ) : (
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Helpful" onClick={() => rate("up")} className={THUMB}>
              <ThumbsUp className="h-4 w-4 text-[var(--hive-ok-fg)]" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Not helpful"
              onClick={() => rate("down")}
              className={THUMB}
            >
              <ThumbsDown className="h-4 w-4 text-[var(--hive-danger-fg)]" aria-hidden="true" />
            </button>
          </div>
        ))}
    </div>
  );
}
