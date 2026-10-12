import { ArrowRight, CircleAlert } from "lucide-react";
import type { PacketNextAction } from "@/lib/obligations/packet";

function urgencyClass(urgency: PacketNextAction["urgency"]): string {
  if (urgency === "critical") return "border-danger-200 bg-danger-50 text-danger-700";
  if (urgency === "high") return "border-warning-200 bg-warning-50 text-warning-700";
  return "border-pt2 bg-pt text-ink";
}

export function PacketNextActionCard({
  nextAction,
  emptyLabel,
}: {
  nextAction: PacketNextAction | null | undefined;
  emptyLabel: string;
}) {
  if (!nextAction) {
    return (
      <div className="rounded-[var(--denim-r)] border border-line bg-paper px-4 py-3 text-sm text-muted-foreground shadow-[var(--denim-shadow-sm)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--denim-r)] border px-4 py-3 ${urgencyClass(nextAction.urgency)}`}
    >
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.1em]">Next action</p>
      <p className="mt-1 font-display font-semibold tracking-[-0.01em]">{nextAction.title}</p>
      <p className="mt-0.5 text-sm">{nextAction.reason}</p>
      <a
        href={nextAction.href}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
      >
        Open
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export function PacketScopeNote({ scoped, count }: { scoped: boolean; count: number }) {
  if (!scoped) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-pt0 px-3 py-2 text-xs text-muted-foreground">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>Showing your scope only ({count} staff). Org-wide view returns when Scope is unset.</p>
    </div>
  );
}
