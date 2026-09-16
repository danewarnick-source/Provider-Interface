import type { Decision, DecisionActionKind } from "@/lib/obligations/this-week";
import { decorateDecision } from "@/lib/obligations/this-week";
import { OVERRIDE_STATE_LABEL, OVERRIDE_STILL_REQUIRED } from "@/lib/obligations/overrides";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./decision-card.css";

function urgencyBar(urgency: Decision["urgency"]): string {
  if (urgency === "critical") return "var(--hive-danger)";
  if (urgency === "high") return "var(--hive-gold)";
  return "var(--hive-ok)";
}

function pillClass(dueText: string): string {
  if (dueText === "Done") return "hive-status-active";
  if (dueText === "Today" || /overdue/i.test(dueText) || dueText === "Yesterday") {
    return "hive-status-danger";
  }
  return "hive-role-pill";
}

export function DecisionCard({
  item,
  done = false,
  reviewing = false,
  viewerUserId,
  onAction,
  onRecordOverride,
}: {
  item: Decision;
  done?: boolean;
  reviewing?: boolean;
  viewerUserId?: string | null;
  onAction: (kind: DecisionActionKind, decision: "approved" | "rejected" | "open") => void;
  onRecordOverride?: () => void;
}) {
  const decorated = decorateDecision(item, { viewerUserId });
  const headline = decorated.headline ?? decorated.title;
  const dueText = done ? "Done" : (decorated.dueText ?? "Before next review");
  const why = decorated.why ?? "";
  const ownerText = decorated.ownerText ?? "You";
  const ifMissed = decorated.ifMissed ?? "Part IV finding";
  const action = decorated.action ?? { label: "Log a plan", kind: "log_plan" as const };

  return (
    <li
      data-testid="decision-card"
      className={cn("act", done && "act-done")}
      style={{ borderLeftColor: urgencyBar(decorated.urgency) }}
    >
      <div className="act-head">
        <div data-testid="decision-headline" className="act-headline">
          {headline}
        </div>
        <span data-testid="decision-due" className={cn("act-pill", pillClass(dueText))}>
          {dueText}
        </span>
      </div>
      <p data-testid="decision-why" className="act-why">
        {why}
      </p>
      {item.overridden ? (
        <p data-testid="override-state" className="act-why text-[var(--hive-on-gold)]">
          {OVERRIDE_STATE_LABEL}
          {item.overrideUntil ? ` until ${item.overrideUntil}` : ""}. {OVERRIDE_STILL_REQUIRED}
        </p>
      ) : null}
      <div className="act-meta">
        <span data-testid="decision-owner">Owner: {ownerText}</span>
        <span data-testid="decision-if-missed">If missed: {ifMissed}</span>
      </div>
      {done ? null : action.kind === "approve_plan" ? (
        <div data-testid="decision-action" className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={reviewing}
            onClick={() => onAction("approve_plan", "approved")}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={reviewing}
            onClick={() => onAction("approve_plan", "rejected")}
          >
            Reject
          </Button>
        </div>
      ) : (
        <div data-testid="decision-action" className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onAction(action.kind, "open")}>
            {action.label}
          </Button>
          {onRecordOverride ? (
            <Button type="button" size="sm" variant="outline" onClick={onRecordOverride}>
              Record override
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}
