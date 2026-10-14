// The Ask conversation for this visit (N6). It lives in memory only, never in
// browser storage: opening a source from an answer and coming back finds the
// chat as it was, and a reload starts fresh. Each conversation is keyed by
// person and agency, so someone else (or another agency) never sees it.
// Pure: no React, no aliases, so node --test can import it.

export interface ChatState<T> {
  readonly turns: readonly T[];
  /** A question is waiting for its answer. */
  readonly pending: boolean;
}

export interface ChatStore<T> {
  get(key: string): ChatState<T>;
  update(key: string, next: (state: ChatState<T>) => ChatState<T>): void;
  clear(key: string): void;
  subscribe(listener: () => void): () => void;
}

const EMPTY: ChatState<never> = Object.freeze({ turns: Object.freeze([]), pending: false });

/** The conversation key for a person in an agency, or null until both are known. */
export function chatKey(
  userId: string | null | undefined,
  orgId: string | null | undefined,
): string | null {
  return userId && orgId ? `${userId}:${orgId}` : null;
}

/**
 * A small keyed store for useSyncExternalStore: get() returns the same object
 * until the conversation changes. It keeps the last `maxTurns` turns of the
 * last `maxKeys` conversations.
 */
export function createChatStore<T>({ maxTurns = 60, maxKeys = 3 } = {}): ChatStore<T> {
  const chats = new Map<string, ChatState<T>>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: (key) => chats.get(key) ?? EMPTY,
    update(key, next) {
      const state = next(chats.get(key) ?? EMPTY);
      chats.delete(key);
      chats.set(key, { turns: state.turns.slice(-maxTurns), pending: state.pending });
      while (chats.size > maxKeys) chats.delete(chats.keys().next().value as string);
      notify();
    },
    clear(key) {
      if (chats.delete(key)) notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
