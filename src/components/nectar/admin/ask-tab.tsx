// Admin Nectar's Ask tab (N6, as in the demo): the chat, each answer labeled
// "Nectar · AI assistant" with its source chips and thumbs, suggested
// questions, and the "Guide me" and "Ask the PI team" actions. Owners and
// agency-wide admins ask about the whole agency; other admins ask in their
// own scope. The conversation lives in memory for this visit only.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { NectarButton } from "@/components/nectar/nectar-brand";
import { NectarReply } from "@/components/nectar/nectar-reply";
import { NectarTaskCenter } from "@/components/nectar/nectar-task-center";
import { useAskStatus } from "@/components/nectar/use-ask-nectar";
import { useNectarChat } from "@/components/nectar/use-nectar-chat";
import { adminSourceHref, staffSourceHref } from "@/lib/nectar/source-links";
import { escalateHelpToHive, getHelpTicketStatus } from "@/lib/nectar/support.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import {
  AskOffNotice,
  NectarBubble,
  NectarNote,
  Suggestions,
  ThinkingBubble,
  UserBubble,
} from "../chat-parts";
import { AskActions } from "./ask-actions";

const helpRoute = getRouteApi("/dashboard/help");

const SUGGESTIONS = [
  "Which required policies are we missing?",
  "How many team members have reviewed each policy?",
  "What should team members do if someone falls?",
  "What does the contract say a service note needs?",
];

const GUIDE_ME = /\b(walk me through|guide me|help me with|show me how|tour)\b/i;

export function AskTab({
  canSeeQuestions,
  onOpenSettings,
}: {
  canSeeQuestions: boolean;
  /** Shown with the "Ask is turned off" notice to people who can turn it back on. */
  onOpenSettings?: () => void;
}) {
  const chat = useNectarChat("admin");
  const orgId = chat.organizationId;
  const askStatus = useAskStatus(orgId);
  const askOff = askStatus.data?.on === false;
  const [input, setInput] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ open: boolean; goal?: string }>({ open: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const escalate = useServerFn(escalateHelpToHive);
  const getStatus = useServerFn(getHelpTicketStatus);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.turns.length, chat.pending]);

  const ticketQ = useQuery({
    queryKey: ["help-ticket", ticketId],
    enabled: !!ticketId && !!orgId,
    queryFn: () => getStatus({ data: { ticketId: ticketId!, organizationId: orgId! } }),
    refetchInterval: 15_000,
  });

  function send(text: string) {
    const q = text.trim();
    if (GUIDE_ME.test(q)) {
      setInput("");
      setGuide({ open: true, goal: q });
      return;
    }
    if (!askOff && chat.send(q)) setInput("");
  }

  // A question from the header search (/dashboard/help?q=…) is asked once.
  const { q: initialQ } = helpRoute.useSearch();
  const navigate = helpRoute.useNavigate();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !initialQ || !chat.ready || askStatus.isLoading) return;
    fired.current = true;
    send(initialQ);
    void navigate({ search: (prev) => ({ ...prev, q: undefined }), replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, chat.ready, askStatus.isLoading]);

  const escalateM = useMutation({
    mutationFn: async () => {
      const lastUser = [...chat.turns].reverse().find((t) => t.role === "user");
      const context = chat.turns
        .slice(-6)
        .map((t) => `${t.role === "user" ? "Me" : "Nectar"}: ${t.text}`)
        .join("\n");
      const question = lastUser?.text ?? "I'd like to talk to a person at PI.";
      return escalate({ data: { question, context, organizationId: orgId ?? "" } });
    },
    onSuccess: (r) => {
      setTicketId(r.ticketId);
      chat.say(
        "I've connected you with the PI team. Someone will follow up shortly. You can keep asking me in the meantime.",
      );
    },
    onError: (e) => chat.say(safeErrorMessage(e, "Couldn't reach the PI team. Please try again.")),
  });

  const sourceHref = chat.view === "admin" ? adminSourceHref : staffSourceHref;
  const notFoundNote = canSeeQuestions
    ? "It's listed under Questions so you can add a policy."
    : "I've sent your question to your admin so it can be added.";

  return (
    <div className="max-w-3xl space-y-3">
      <AskActions
        canClear={chat.turns.length > 0 && !chat.pending}
        onGuide={() => setGuide({ open: true })}
        onClear={chat.clear}
        onAskPi={() => escalateM.mutate()}
        askingPi={escalateM.isPending}
        ticketId={ticketId}
        ticket={ticketQ.data}
      />
      {askOff && (
        <AskOffNotice>
          {onOpenSettings ? (
            <button type="button" onClick={onOpenSettings} className="ml-2 underline">
              Turn it on in AI settings
            </button>
          ) : null}
        </AskOffNotice>
      )}
      <div
        ref={scrollRef}
        className="h-[min(60vh,640px)] min-h-[280px] overflow-y-auto rounded-xl border border-border bg-[#fbfaf7] p-4"
      >
        {chat.turns.length === 0 && !chat.pending ? (
          <p className="text-sm text-muted-foreground">
            Ask about your policies, reviews or the state rules. Every answer shows where it came
            from.
          </p>
        ) : null}
        <ul className="space-y-3">
          {chat.turns.map((turn) => (
            <li key={turn.id}>
              {turn.role === "user" ? (
                <UserBubble text={turn.text} />
              ) : turn.reply ? (
                <NectarBubble>
                  <NectarReply
                    reply={turn.reply}
                    sourceHref={sourceHref}
                    onRate={chat.rate}
                    rated={turn.rated}
                    notFoundNote={notFoundNote}
                  />
                </NectarBubble>
              ) : (
                <NectarNote text={turn.text} />
              )}
            </li>
          ))}
          {chat.pending && (
            <li>
              <ThinkingBubble />
            </li>
          )}
        </ul>
      </div>
      <Suggestions items={SUGGESTIONS} onPick={send} disabled={askOff || chat.pending} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <label htmlFor="nectar-admin-question" className="sr-only">
          Ask Nectar
        </label>
        <input
          id="nectar-admin-question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your policies, reviews or the state rules"
          autoComplete="off"
          disabled={askOff}
          className="min-h-[44px] min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--hive-gold)]/40 disabled:opacity-60"
        />
        <NectarButton
          type="submit"
          disabled={askOff || input.trim().length < 2 || !chat.ready}
          loading={chat.pending}
          icon={<Send className="h-4 w-4" />}
        >
          Ask
        </NectarButton>
      </form>
      <NectarTaskCenter
        open={guide.open}
        onOpenChange={(open) => setGuide(open ? { ...guide, open } : { open: false })}
        initialGoal={guide.goal}
      />
    </div>
  );
}
