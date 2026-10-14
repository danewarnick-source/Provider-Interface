import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime12, nameWithStrength } from "@/lib/medications/med-display";
import type { GiveMed } from "@/lib/medications/give-meds";

/** What it's for and what to watch for, under the medication name. */
export function MedSummary({ med }: { med: GiveMed }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold leading-snug">
        {nameWithStrength(med)}
        {med.dose_form ? (
          <span className="font-normal text-muted-foreground"> {med.dose_form}</span>
        ) : null}
      </p>
      {med.purpose ? <p className="text-xs text-muted-foreground">For: {med.purpose}</p> : null}
      {med.side_effects ? (
        <p className="text-xs text-muted-foreground">Watch for: {med.side_effects}</p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {med.is_controlled ? (
          <Badge variant="outline" className="text-[10px]">
            Count required
          </Badge>
        ) : null}
        {med.is_rescue ? (
          <Badge variant="outline" className="text-[10px]">
            Rescue
          </Badge>
        ) : null}
        {med.is_psychotropic ? (
          <Badge variant="outline" className="text-[10px]">
            Psychotropic
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function DoseRow({
  med,
  time,
  late,
  onGive,
  onNotGiven,
  hint,
}: {
  med: GiveMed;
  /** "HH:MM" for a scheduled dose; omitted for an as-needed medication. */
  time?: string;
  late?: boolean;
  onGive: () => void;
  onNotGiven?: () => void;
  hint?: string | null;
}) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span
          className={`w-16 shrink-0 font-mono text-xs ${late ? "text-rose-600 font-semibold" : "text-muted-foreground"}`}
        >
          {time ? formatTime12(time) : "As needed"}
        </span>
        <div className="min-w-0">
          <MedSummary med={med} />
          {med.is_prn && med.prn_instructions ? (
            <p className="text-xs text-muted-foreground">When: {med.prn_instructions}</p>
          ) : null}
          {med.is_prn && med.prn_try_first ? (
            <p className="text-xs text-muted-foreground">Try first: {med.prn_try_first}</p>
          ) : null}
          {hint ? <p className="mt-1 text-xs font-medium text-amber-700">{hint}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-[4.75rem] sm:pl-0">
        <Button size="sm" className="h-10" onClick={onGive}>
          Given now
        </Button>
        {onNotGiven ? (
          <Button size="sm" variant="outline" className="h-10" onClick={onNotGiven}>
            Not given
          </Button>
        ) : null}
      </div>
    </li>
  );
}
