// The admin Nectar chat's header (N5): "Guide me", "New chat" and "Ask the PI
// team", and the PI support ticket's status once one is open. N6 keeps the
// two actions.

import { CheckCircle2, ListChecks, Loader2, LifeBuoy, RotateCcw } from "lucide-react";
import { NectarBadge, NectarMark } from "@/components/nectar/nectar-brand";

const ACTION = "inline-flex min-h-[44px] items-center gap-1 rounded-md px-3 py-1 text-xs";

export function HelpChatHeader({
  canClear,
  onGuide,
  onClear,
  onAskPi,
  askingPi,
  ticketId,
  ticket,
}: {
  canClear: boolean;
  onGuide: () => void;
  onClear: () => void;
  onAskPi: () => void;
  askingPi: boolean;
  ticketId: string | null;
  ticket: { status: string; updated_at: string } | null | undefined;
}) {
  return (
    <>
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2 sm:mb-3 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <NectarMark size="md" />
          <div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <NectarBadge size="xs" />
              <span>AI assistant</span>
            </div>
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--hive-text)] sm:text-2xl">
              Ask Nectar
            </h1>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Answers come only from your agency's documents, the state rules and your agency's
              facts, with their sources.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 sm:gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onGuide}
              className={`${ACTION} bg-[var(--hive-gold)] font-semibold text-white shadow-sm hover:bg-[#b8651a]`}
            >
              <ListChecks className="h-3.5 w-3.5" /> Guide me
            </button>
            {canClear && (
              <button
                type="button"
                onClick={onClear}
                className={`${ACTION} border border-border hover:bg-muted`}
              >
                <RotateCcw className="h-3.5 w-3.5" /> New chat
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onAskPi}
            disabled={askingPi || !!ticketId}
            className={`${ACTION} border border-[#fed7aa] bg-[#fff7ed] font-medium text-[#9a3412] hover:bg-[#ffedd5] disabled:opacity-60`}
          >
            {askingPi ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LifeBuoy className="h-3.5 w-3.5" />
            )}
            {ticketId ? "Connected with PI" : "Ask the PI team"}
          </button>
        </div>
      </header>

      {ticketId && ticket && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-xs text-[#1e40af]">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            PI support ticket. Status:{" "}
            <span className="font-semibold capitalize">{ticket.status.replace(/_/g, " ")}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wide text-[#1e40af]/70">
            Updated {new Date(ticket.updated_at).toLocaleString()}
          </span>
        </div>
      )}
    </>
  );
}
