// Team member Nectar's Ask tab (N6, as in the demo; replaces
// staff-mobile/ask-nectar-staff.tsx): the intro line, the chat with source
// chips that open the policy or plan read-only, thumbs, and a Mark "<policy>"
// as reviewed button in an answer that cites a policy they haven't reviewed.
// The server decides what the caller may read; pay and hours questions get
// its fixed refusal. The conversation lives in memory for this visit only.
//
// The composer is an in-flow shrink-0 footer (not a portal), so a swipe or
// overscroll on the thread can't hide it. Its bottom padding clears the
// bottom tabs and the clocked-in bar.

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { NectarButton } from "@/components/nectar/nectar-brand";
import { NectarReply } from "@/components/nectar/nectar-reply";
import { useAskStatus } from "@/components/nectar/use-ask-nectar";
import { useNectarChat, type ChatTurn } from "@/components/nectar/use-nectar-chat";
import { useMobileShellContainer } from "@/components/staff-mobile/mobile-shell-context";
import { Button } from "@/components/ui/button";
import { useActiveShiftBarVisible } from "@/hooks/use-active-shift-bar";
import {
  markReviewedLabel,
  unreviewedCitedPolicy,
  type StaffPolicy,
} from "@/lib/nectar/library/staff-policies";
import { staffSourceHref } from "@/lib/nectar/source-links";
import {
  STAFF_CLOCK_BAR_PX,
  STAFF_TAB_BAR_OFFSET_CSS,
  STAFF_TAB_BAR_PX,
} from "@/lib/staff-phone-chrome";
import {
  AskOffNotice,
  NectarBubble,
  NectarNote,
  Suggestions,
  ThinkingBubble,
  UserBubble,
} from "../chat-parts";
import { useMarkReviewed, useMyPolicies } from "./use-staff-policies";

const STAFF_ASK_INTRO =
  "Nectar is an AI assistant. It answers from your agency's policies, the state contract and the plans of the people you support, and shows where each answer came from. It can't answer pay or hours questions.";

const SUGGESTIONS = [
  "What do I do if someone falls?",
  "What are the must-knows for the people I support?",
  "My relief is late, can I leave?",
  "What does the contract say a service note needs?",
  "What's my schedule this week?",
];

const NOT_FOUND_NOTE = "I've sent your question to your admin so it can be added.";

/** Ignore rubber-band / swipe; only treat a real keyboard shrink as lift. */
const KEYBOARD_LIFT_MIN_PX = 80;

export function StaffAskTab({
  initialQuestion,
  onAsked,
}: {
  /** A question from the header search, asked once. */
  initialQuestion?: string;
  onAsked?: () => void;
}) {
  const chat = useNectarChat("staff");
  const orgId = chat.organizationId;
  const askStatus = useAskStatus(orgId);
  const askOff = askStatus.data?.on === false;
  const policies = useMyPolicies(orgId).data?.policies ?? [];
  const mark = useMarkReviewed(orgId);
  const [input, setInput] = useState("");
  const [keyboardLift, setKeyboardLift] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const { container } = useMobileShellContainer();
  const barVisible = useActiveShiftBarVisible();
  const inStaffShell = !!container;

  const chromePadCss = useMemo(() => {
    if (!inStaffShell) return "0.75rem";
    if (keyboardLift >= KEYBOARD_LIFT_MIN_PX) return `calc(${keyboardLift}px + 0.5rem)`;
    if (barVisible) {
      return `calc(${STAFF_TAB_BAR_PX + STAFF_CLOCK_BAR_PX}px + env(safe-area-inset-bottom, 0px) + 0.5rem)`;
    }
    return `calc(${STAFF_TAB_BAR_OFFSET_CSS} + 0.5rem)`;
  }, [barVisible, inStaffShell, keyboardLift]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.turns.length, chat.pending]);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const updateKeyboard = () => {
      const lift = Math.max(0, window.innerHeight - vv.height);
      setKeyboardLift(lift >= KEYBOARD_LIFT_MIN_PX ? lift : 0);
    };
    updateKeyboard();
    vv.addEventListener("resize", updateKeyboard);
    return () => vv.removeEventListener("resize", updateKeyboard);
  }, []);

  const send = (q: string) => {
    if (askOff || !chat.send(q)) return;
    setInput("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !initialQuestion || !chat.ready || askStatus.isLoading) return;
    fired.current = true;
    send(initialQuestion);
    onAsked?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, chat.ready, askStatus.isLoading]);

  return (
    <div
      data-ask-nectar-chat
      className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none"
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-none px-4 py-3"
      >
        <div className="space-y-1 rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] leading-snug text-muted-foreground">
          <p>{STAFF_ASK_INTRO}</p>
          <p className="text-[11px]">
            Client details here are only for the people you support. Keep them private.
          </p>
        </div>
        {askOff && <AskOffNotice />}
        {chat.turns.map((turn) => (
          <StaffTurn
            key={turn.id}
            turn={turn}
            policies={policies}
            onRate={chat.rate}
            onMark={(documentId) => mark.mutate(documentId)}
            marking={mark.isPending}
          />
        ))}
        {chat.pending && <ThinkingBubble />}
        <Suggestions items={SUGGESTIONS} onPick={send} disabled={askOff || chat.pending} />
      </div>

      <form
        data-ask-nectar-composer
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="shrink-0 border-t border-border bg-background/98 px-3 pt-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/92"
        style={{ paddingBottom: chromePadCss }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="nectar-staff-question" className="sr-only">
            Ask Nectar
          </label>
          <textarea
            id="nectar-staff-question"
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask a question"
            rows={1}
            disabled={askOff}
            className="min-h-[48px] max-h-32 flex-1 resize-none rounded-full border border-input bg-background px-4 py-3 text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hive-gold)]/40 disabled:opacity-60"
          />
          <NectarButton
            type="submit"
            variant="amber"
            loading={chat.pending}
            icon={<Send className="h-4 w-4" />}
            disabled={askOff || !input.trim() || !chat.ready}
            className="h-12 min-w-[48px] rounded-full"
          >
            <span className="sr-only">Ask</span>
          </NectarButton>
        </div>
      </form>
    </div>
  );
}

function StaffTurn({
  turn,
  policies,
  onRate,
  onMark,
  marking,
}: {
  turn: ChatTurn;
  policies: readonly StaffPolicy[];
  onRate: (questionId: string, value: "up" | "down") => Promise<unknown>;
  onMark: (documentId: string) => void;
  marking: boolean;
}) {
  if (turn.role === "user") return <UserBubble text={turn.text} />;
  if (!turn.reply) return <NectarNote text={turn.text} />;
  const policy = unreviewedCitedPolicy(turn.reply.sources, policies);
  return (
    <NectarBubble>
      <NectarReply
        reply={turn.reply}
        sourceHref={(s) => staffSourceHref(s, "ask")}
        onRate={onRate}
        rated={turn.rated}
        notFoundNote={NOT_FOUND_NOTE}
      >
        {policy ? (
          <Button
            type="button"
            disabled={marking}
            onClick={() => onMark(policy.documentId)}
            className="h-auto min-h-[44px] w-full justify-start whitespace-normal bg-[var(--hive-ok-fg)] text-left text-white hover:bg-[var(--hive-ok-fg)]/90"
          >
            {markReviewedLabel(policy.title)}
          </Button>
        ) : null}
      </NectarReply>
    </NectarBubble>
  );
}
