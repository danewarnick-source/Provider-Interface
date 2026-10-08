// Last setup screen: what's set up and what was skipped, each skipped step
// with a button to where it's added later.

import { CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setupSummary, type SetupStep, type StepOutcome } from "@/lib/clients/client-setup";
import { CLIENT_SECTION_LABEL, type ClientProfileSection } from "@/lib/clients/profile-sections";

export function SetupSummary({
  outcomes,
  onOpenSection,
}: {
  outcomes: Partial<Record<SetupStep, StepOutcome>>;
  onOpenSection: (section: ClientProfileSection) => void;
}) {
  const lines = setupSummary(outcomes, (s) => CLIENT_SECTION_LABEL[s]);
  return (
    <ul className="space-y-2" data-testid="client-setup-summary">
      {lines.map((l) => (
        <li
          key={l.step}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hive-border px-3 py-2"
        >
          <span className="flex items-center gap-2 text-sm">
            {l.done ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--hive-ok)]" aria-hidden />
            ) : (
              <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <span className="font-medium text-hive-ink">{l.label}</span>
            <span className="text-muted-foreground">· {l.text}</span>
          </span>
          {l.linkLabel ? (
            <Button variant="outline" className="max-md:min-h-11" onClick={() => onOpenSection(l.section)}>
              {l.linkLabel}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
