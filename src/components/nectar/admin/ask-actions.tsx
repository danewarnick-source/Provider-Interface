// The admin Ask tab's actions (N5, kept in N6): "Guide me" opens the task
// center, "New chat" clears this visit's conversation, and "Ask the PI team"
// opens a support ticket and shows its status.

import { CheckCircle2, ListChecks, Loader2, LifeBuoy, RotateCcw } from "lucide-react";

const ACTION = "inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs";

export function AskActions({
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGuide}
          className={`${ACTION} bg-[var(--hive-gold)] font-semibold text-white shadow-sm hover:bg-[#b8651a]`}
        >
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> Guide me
        </button>
        <button
          type="button"
          onClick={onAskPi}
          disabled={askingPi || !!ticketId}
          className={`${ACTION} border border-[#fed7aa] bg-[#fff7ed] font-medium text-[#9a3412] hover:bg-[#ffedd5] disabled:opacity-60`}
        >
          {askingPi ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {ticketId ? "Connected with PI" : "Ask the PI team"}
        </button>
        {canClear && (
          <button
            type="button"
            onClick={onClear}
            className={`${ACTION} border border-border hover:bg-muted`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> New chat
          </button>
        )}
      </div>

      {ticketId && ticket && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-xs text-[#1e40af]">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            PI support ticket. Status:{" "}
            <span className="font-semibold capitalize">{ticket.status.replace(/_/g, " ")}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wide text-[#1e40af]/70">
            Updated {new Date(ticket.updated_at).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
