// Admin Nectar on /dashboard/help (moved out of the route in N5 and pointed at
// the one engine, askNectar). "Guide me" (the task center) and "Ask the PI
// team" (support.functions.ts) stay. N6 rebuilds this screen into tabs.
// Recent questions live in memory for this visit only, never browser storage.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { NectarButton } from "@/components/nectar/nectar-brand";
import { NectarTaskCenter } from "@/components/nectar/nectar-task-center";
import { useAskNectar } from "@/components/nectar/use-ask-nectar";
import type { AskNectarResult } from "@/lib/nectar/engine/ask-types";
import { escalateHelpToHive, getHelpTicketStatus } from "@/lib/nectar/support.functions";
import {
  HelpEmptyState,
  HelpNectarBubble,
  HelpTypingBubble,
  HelpUserBubble,
} from "./help-chat-parts";
import { HelpChatHeader } from "./help-chat-header";

interface ChatMsg {
  id: string;
  role: "user" | "nectar";
  text: string;
  reply?: AskNectarResult;
}

const STARTERS = [
  "Which required policies are we missing?",
  "How many team members have reviewed our policies?",
  "What does the state require in a grievance policy?",
  "What do our policies say about missed medication doses?",
  "What must a host home do when a person stays away overnight?",
];

const GUIDE_ME = /\b(walk me through|guide me|help me with|show me how|tour)\b/i;

export function HelpChat() {
  const nectar = useAskNectar("admin");
  const organizationId = nectar.organizationId;
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [taskCenterOpen, setTaskCenterOpen] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const escalate = useServerFn(escalateHelpToHive);
  const getStatus = useServerFn(getHelpTicketStatus);
  const say = (role: ChatMsg["role"], text: string, reply?: AskNectarResult) =>
    setMessages((prev) => [
      ...prev,
      { id: `${role}-${Date.now()}-${prev.length}`, role, text, reply },
    ]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ticketQ = useQuery({
    queryKey: ["help-ticket", ticketId],
    enabled: !!ticketId && !!organizationId,
    queryFn: () => getStatus({ data: { ticketId: ticketId!, organizationId: organizationId! } }),
    refetchInterval: 15_000,
  });

  const m = useMutation({
    mutationFn: (q: string) => nectar.ask(q),
    onSuccess: (reply, q) => {
      say("nectar", reply.answer, reply);
      setRecent((prev) => [q, ...prev.filter((x) => x !== q)].slice(0, 8));
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (e) =>
      say("nectar", e instanceof Error ? e.message : "Something went wrong. Please try again."),
  });

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (q.length < 2) return;
    setInput("");
    if (GUIDE_ME.test(q)) {
      setPendingGoal(q);
      setTaskCenterOpen(true);
      return;
    }
    say("user", q);
    m.mutate(q);
  }

  // A question routed in from the header search (/dashboard/help?q=…) is sent once.
  const { q: initialQ } = useSearch({ from: "/dashboard/help" });
  const initialFired = useRef(false);
  useEffect(() => {
    if (initialFired.current || !initialQ || !organizationId) return;
    initialFired.current = true;
    send(initialQ);
    navigate({ to: "/dashboard/help", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, organizationId]);

  const escalateM = useMutation({
    mutationFn: async () => {
      const lastUser = [...messages].reverse().find((mm) => mm.role === "user");
      const context = messages
        .slice(-6)
        .map((mm) => `${mm.role === "user" ? "Me" : "Nectar"}: ${mm.text}`)
        .join("\n");
      const question = lastUser?.text ?? "I'd like to talk to a person at PI.";
      return escalate({ data: { question, context, organizationId: organizationId ?? "" } });
    },
    onSuccess: (r) => {
      setTicketId(r.ticketId);
      say(
        "nectar",
        "I've connected you with the PI team. Someone will follow up shortly. You can keep asking me in the meantime.",
      );
    },
    onError: (e) =>
      say(
        "nectar",
        e instanceof Error ? e.message : "Couldn't reach the PI team. Please try again.",
      ),
  });

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      <HelpChatHeader
        canClear={messages.length > 0}
        onGuide={() => {
          setPendingGoal(undefined);
          setTaskCenterOpen(true);
        }}
        onClear={() => setMessages([])}
        onAskPi={() => escalateM.mutate()}
        askingPi={escalateM.isPending}
        ticketId={ticketId}
        ticket={ticketQ.data}
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-xl border border-border bg-[#fbfaf7] p-4 shadow-sm"
      >
        {messages.length === 0 && (
          <HelpEmptyState starters={STARTERS} recent={recent} onPick={send} />
        )}
        <ul className="space-y-3">
          {messages.map((msg) => (
            <li key={msg.id}>
              {msg.role === "user" ? (
                <HelpUserBubble text={msg.text} />
              ) : (
                <HelpNectarBubble
                  text={msg.text}
                  reply={msg.reply}
                  linkSources={nectar.view === "admin"}
                  onRate={nectar.rate}
                />
              )}
            </li>
          ))}
          {m.isPending && (
            <li>
              <HelpTypingBubble />
            </li>
          )}
        </ul>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your policies, the state rules or your agency…"
          className="min-h-[44px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--hive-gold)]/40"
          disabled={m.isPending}
        />
        <NectarButton
          type="submit"
          disabled={input.trim().length < 2}
          loading={m.isPending}
          icon={<Send className="h-4 w-4" />}
        >
          Send
        </NectarButton>
      </form>
      <NectarTaskCenter
        open={taskCenterOpen}
        onOpenChange={(o) => {
          setTaskCenterOpen(o);
          if (!o) setPendingGoal(undefined);
        }}
        initialGoal={pendingGoal}
      />
    </div>
  );
}
