// Pieces of the admin Nectar chat (/dashboard/help), moved out of the route
// in N5. N6 rebuilds this screen.

import { useState } from "react";
import { PiMark } from "@/components/pi-landing/pi-mark";
import { NectarMark } from "@/components/nectar/nectar-brand";
import { NectarAnswer } from "@/components/nectar/nectar-answer";
import { NectarReply } from "@/components/nectar/nectar-reply";
import type { AskNectarResult, FeedbackValue } from "@/lib/nectar/engine/ask-types";

export function HelpEmptyState({
  starters,
  recent,
  onPick,
}: {
  starters: string[];
  recent: string[];
  onPick: (q: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_COUNT = 3;
  const visible = showAll ? starters : starters.slice(0, DEFAULT_COUNT);
  const hasMore = starters.length > DEFAULT_COUNT;
  const chip =
    "min-h-[36px] rounded-full border bg-white px-2.5 py-1 text-xs shadow-sm sm:min-h-[44px] sm:px-3 sm:py-1.5";
  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center sm:gap-4 sm:py-8">
      <div className="hidden flex-col items-center gap-3 sm:flex">
        <NectarMark size="lg" />
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--hive-text)]">
            Hi! I'm Nectar.
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            I answer from your agency's documents, the state rules and your agency's facts, and I
            show where each answer came from.
          </p>
        </div>
      </div>
      <div className="w-full max-w-xl">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-xs">
          Try one of these
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          {visible.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className={`${chip} border-[#fed7aa] text-[var(--hive-text)] hover:bg-[#fff7ed]`}
            >
              {s}
            </button>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={`${chip} border-border text-muted-foreground hover:bg-muted`}
            >
              {showAll ? "Fewer" : "More suggestions"}
            </button>
          )}
        </div>
      </div>
      {recent.length > 0 && (
        <div className="w-full max-w-xl">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-xs">
            Recent
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {recent.slice(0, showAll ? recent.length : 3).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onPick(r)}
                className={`${chip} border-border text-muted-foreground hover:bg-muted`}
              >
                {r.length > 60 ? r.slice(0, 57) + "…" : r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HelpUserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--hive-text)] px-3.5 py-2 text-sm text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--hive-text)] text-[var(--hive-gold)] shadow-sm">
      <PiMark className="h-4 w-4" />
    </div>
  );
}

/** Nectar's turn: an answer with its sources and thumbs, or a plain note (errors, PI team). */
export function HelpNectarBubble({
  text,
  reply,
  linkSources,
  onRate,
}: {
  text: string;
  reply?: AskNectarResult;
  linkSources: boolean;
  onRate: (questionId: string, value: FeedbackValue) => Promise<unknown>;
}) {
  return (
    <div className="flex items-start gap-2">
      <Avatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#fed7aa] bg-white px-3.5 py-2.5 text-sm text-[var(--hive-text)] shadow-sm">
        {reply ? (
          <NectarReply reply={reply} linkSources={linkSources} onRate={onRate} />
        ) : (
          <NectarAnswer text={text} />
        )}
      </div>
    </div>
  );
}

export function HelpTypingBubble() {
  return (
    <div className="flex items-start gap-2">
      <Avatar />
      <div className="rounded-2xl rounded-tl-sm border border-[#fed7aa] bg-white px-3.5 py-2 text-sm text-muted-foreground shadow-sm">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hive-gold)] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hive-gold)] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hive-gold)]" />
        </span>
      </div>
    </div>
  );
}
