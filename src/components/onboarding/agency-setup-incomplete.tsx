import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AGENCY_SETUP_INCOMPLETE_MESSAGE,
  AGENCY_SETUP_PATH,
  type AgencySetupStatus,
} from "@/lib/agency-setup-gate";

export function AgencySetupIncompleteCard({
  status,
  title = "Finish agency setup first",
}: {
  status: AgencySetupStatus;
  title?: string;
}) {
  return (
    <div
      data-testid="agency-setup-incomplete"
      className="max-w-xl rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <ClipboardList className="h-5 w-5" />
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{AGENCY_SETUP_INCOMPLETE_MESSAGE}</p>
      <p className="mt-3 text-sm">
        Setup progress: <strong>{status.progressLabel}</strong> required operating questions
        answered.
      </p>
      {status.unanswered.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {status.unanswered.map((q) => (
            <li key={q.key}>{q.question}</li>
          ))}
        </ul>
      ) : null}
      <Button asChild className="mt-5">
        <Link to={AGENCY_SETUP_PATH} search={{ reason: "setup_incomplete" }}>
          Continue setup
        </Link>
      </Button>
    </div>
  );
}
