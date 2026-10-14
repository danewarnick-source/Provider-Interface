// One Ask conversation (N6) for the admin or the team member screen. It is
// kept in memory for this visit (lib/nectar/chat-store.ts), never in browser
// storage, so opening a source and coming back finds the chat as it was.

import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { chatKey, createChatStore } from "@/lib/nectar/chat-store";
import type { AskNectarResult, AskView, FeedbackValue } from "@/lib/nectar/engine/ask-types";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { nectarKey, useAskNectar } from "./use-ask-nectar";

export interface ChatTurn {
  id: string;
  role: "user" | "nectar";
  text: string;
  /** Set on an answer from askNectar; plain notes (errors, the PI team) have none. */
  reply?: AskNectarResult;
  /** The thumbs given to this answer, so they stay given after leaving and coming back. */
  rated?: FeedbackValue;
}

const STORES = { admin: createChatStore<ChatTurn>(), staff: createChatStore<ChatTurn>() };
let seq = 0;
const nextId = () => `turn-${Date.now().toString(36)}-${(seq += 1)}`;

export function useNectarChat(screen: AskView) {
  const nectar = useAskNectar(screen);
  const { user } = useAuth();
  const qc = useQueryClient();
  const store = STORES[screen];
  const orgId = nectar.organizationId;
  const key = chatKey(user?.id, orgId);
  const state = useSyncExternalStore(
    store.subscribe,
    () => store.get(key ?? ""),
    () => store.get(""),
  );

  const refreshQuestions = () => qc.invalidateQueries({ queryKey: nectarKey(orgId, "questions") });
  const add = (k: string, turn: Omit<ChatTurn, "id">, pending: boolean) =>
    store.update(k, (s) => ({ turns: [...s.turns, { ...turn, id: nextId() }], pending }));

  // The answer goes to the conversation it was asked in, even after leaving the page.
  async function ask(k: string, q: string) {
    try {
      const reply = await nectar.ask(q);
      add(k, { role: "nectar", text: reply.answer, reply }, false);
      if (reply.refusal === "off") {
        void qc.invalidateQueries({ queryKey: nectarKey(orgId, "ask-status") });
      } else if (!reply.found) {
        void refreshQuestions();
      }
    } catch (e) {
      add(
        k,
        { role: "nectar", text: safeErrorMessage(e, "Something went wrong. Try again.") },
        false,
      );
    }
  }

  /** Asks Nectar; false when nothing was sent (too short, still loading, or one is waiting). */
  function send(text: string): boolean {
    const q = text.trim();
    if (q.length < 2 || !key || store.get(key).pending) return false;
    add(key, { role: "user", text: q }, true);
    void ask(key, q);
    return true;
  }

  async function rate(questionId: string, value: FeedbackValue) {
    const result = await nectar.rate(questionId, value);
    if (key) {
      store.update(key, (s) => ({
        ...s,
        turns: s.turns.map((t) =>
          t.reply?.questionId === questionId ? { ...t, rated: value } : t,
        ),
      }));
    }
    if (value === "down") void refreshQuestions();
    return result;
  }

  return {
    organizationId: orgId,
    /** The view the server answers in: admin (agency-wide admins on the admin screen) or staff. */
    view: nectar.view,
    ready: !!key,
    turns: state.turns,
    pending: state.pending,
    send,
    rate,
    /** A plain note from Nectar in the chat (the PI team, errors). */
    say: (text: string) => {
      if (key) add(key, { role: "nectar", text }, store.get(key).pending);
    },
    clear: () => {
      if (key) store.clear(key);
    },
  };
}
