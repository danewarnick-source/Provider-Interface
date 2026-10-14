// Pieces both Nectar chats use (N6, as in the demo): the person's question,
// Nectar's turn (an answer or a plain note), "Thinking…", suggested questions
// and the notice both Ask screens show while Ask is turned off.

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { NectarAnswer } from "@/components/nectar/nectar-answer";
import { NectarMark } from "@/components/nectar/nectar-brand";
import { ASK_OFF_ANSWER } from "@/lib/nectar/engine/ask-types";
import { cn } from "@/lib/utils";

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-[var(--hive-text)] px-3.5 py-2 text-sm leading-relaxed text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

/** Nectar's turn: an answer (a NectarReply) or a plain note. */
export function NectarBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <NectarMark size="sm" className="mt-0.5" ornament={false} />
      <div className="min-w-0 max-w-[92%] flex-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-3 text-sm text-[var(--hive-text)] shadow-sm">
        {children}
      </div>
    </div>
  );
}

/** A plain note from Nectar: an error, or word from the PI team. */
export function NectarNote({ text }: { text: string }) {
  return (
    <NectarBubble>
      <NectarAnswer text={text} />
    </NectarBubble>
  );
}

export function ThinkingBubble() {
  return (
    <NectarBubble>
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Thinking…
      </span>
    </NectarBubble>
  );
}

/** Suggested questions, as chips. */
export function Suggestions({
  items,
  onPick,
  disabled = false,
  className,
}: {
  items: readonly string[];
  onPick: (question: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="min-h-[36px] rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-[var(--hive-text)] shadow-sm transition hover:border-[var(--hive-gold)]/60 hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** Both Ask screens show this while the agency has Nectar or Ask turned off. */
export function AskOffNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-semibold text-amber-900"
    >
      {ASK_OFF_ANSWER}
      {children}
    </div>
  );
}
