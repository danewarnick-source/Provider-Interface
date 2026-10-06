import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientIntakeProgress } from "@/components/clients/shared/hooks/use-client-intake-progress";

export function IntakeChip({
  organizationId,
  clientId,
  intakeStatus,
  onClick,
}: {
  organizationId: string | undefined;
  clientId: string;
  intakeStatus: string | null | undefined;
  onClick: () => void;
}) {
  const { isLoading, error, hasItems, required, satisfied, isComplete } =
    useClientIntakeProgress(organizationId, clientId);
  if (error) return null;
  if (isLoading) {
    return <span className="text-[11px] text-muted-foreground">…</span>;
  }
  if (!hasItems) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Intake —
      </span>
    );
  }
  const done = isComplete && intakeStatus === "complete";
  const noneStarted = satisfied === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums cursor-pointer transition-opacity hover:opacity-80 " +
        (done
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : noneStarted
            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")
      }
    >
      {done ? "Intake complete" : noneStarted ? "Intake incomplete" : `${satisfied} of ${required} complete`}
    </button>
  );
}

export function IntakeAction({
  organizationId,
  clientId,
  intakeStatus,
}: {
  organizationId: string | undefined;
  clientId: string;
  intakeStatus: string | null | undefined;
}) {
  const { isLoading, error, hasItems, isComplete } = useClientIntakeProgress(
    organizationId,
    clientId,
  );
  if (isLoading || error) return null;
  const done = hasItems && isComplete && intakeStatus === "complete";
  if (done) return null;
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="h-7 gap-1 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <Link to="/dashboard/client-intake/$clientId" params={{ clientId }}>
        Continue intake <ChevronRight className="h-3 w-3" />
      </Link>
    </Button>
  );
}
