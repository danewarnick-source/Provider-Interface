import { Button } from "@/components/ui/button";
import type { GpsFix } from "@/lib/geo";
import { Loader2 } from "lucide-react";

interface PunchPadSubmitFooterProps {
  hardwareDenied: boolean;
  awaitingGps: boolean;
  livePos: GpsFix | null;
  gpsConfident: boolean;
  canSubmit: boolean;
  busy: boolean;
  aiBusy: boolean;
  narrativeOk: boolean;
  correctionRequested: boolean;
  onNarrativeError: () => void;
  onSubmit: () => void;
}

export function PunchPadSubmitFooter({
  hardwareDenied,
  awaitingGps,
  livePos,
  gpsConfident,
  canSubmit,
  busy,
  aiBusy,
  narrativeOk,
  correctionRequested,
  onNarrativeError,
  onSubmit,
}: PunchPadSubmitFooterProps) {
  return (
    <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end text-[11px]">
          {hardwareDenied ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200">
              ⚠️ Location blocked — check device permission
            </span>
          ) : awaitingGps ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Getting location…
            </span>
          ) : livePos && gpsConfident ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-200">
              📍 Location ready ✓
            </span>
          ) : livePos ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200">
              📍 GPS too coarse — waiting
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
              📍 Acquiring location…
            </span>
          )}
        </div>
        <div
          className="w-full"
          onMouseEnter={() => !narrativeOk && onNarrativeError()}
          onClick={() => !narrativeOk && onNarrativeError()}
        >
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || aiBusy}
            className={
              correctionRequested
                ? "w-full bg-amber-600 text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                : "w-full bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            }
          >
            {(busy || aiBusy) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {aiBusy ? "Checking note…" : awaitingGps ? "Getting location…" : "Submit Timeclock"}
          </Button>
        </div>
      </div>
    </div>
  );
}
