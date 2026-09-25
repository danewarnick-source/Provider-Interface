import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NectarInfusionLock } from "@/components/nectar/nectar-infusion-lock";
import { CheckCircle2, ExternalLink, Loader2, Pencil, ShieldCheck } from "lucide-react";

export type PunchPadCompletenessFlag = {
  key: string;
  type: string;
  severity: "soft" | "hard";
  message: string;
  fix?: { label: string; route?: string };
};

interface PunchPadCompletenessPanelProps {
  ran: boolean;
  busy: boolean;
  flags: PunchPadCompletenessFlag[];
  dismissals: Record<string, string>;
  dismissingKey: string | null;
  dismissReason: string;
  onRun: () => void;
  onJumpToFix: (flag: PunchPadCompletenessFlag) => void;
  onStartDismiss: (key: string) => void;
  onCancelDismiss: () => void;
  onDismissReasonChange: (reason: string) => void;
  onConfirmDismiss: (key: string) => void;
}

export function PunchPadCompletenessPanel({
  ran,
  busy,
  flags,
  dismissals,
  dismissingKey,
  dismissReason,
  onRun,
  onJumpToFix,
  onStartDismiss,
  onCancelDismiss,
  onDismissReasonChange,
  onConfirmDismiss,
}: PunchPadCompletenessPanelProps) {
  return (
    <NectarInfusionLock
      featureName="Pre-submit completeness check"
      benefit="NECTAR cross-checks your shift before submit — purchases mentioned vs spending log, approved reimbursements vs receipts, EVV consistency — so issues get fixed before they become audit flags."
    >
      <div className="rounded-lg border-2 border-[color:var(--amber-400)]/50 bg-white/60 px-3 py-3 shadow-sm backdrop-blur sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--navy-900)]">
            <ShieldCheck className="h-4 w-4 text-[color:var(--amber-600)]" />
            NECTAR Completeness Check
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRun}
            disabled={busy}
            className="border-[color:var(--amber-600)]/60 text-[color:var(--amber-700)] hover:bg-[color:var(--amber-50)]"
          >
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {ran ? "Re-check" : "Run check"}
          </Button>
        </div>

        {!ran && !busy && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Run a quick check before submitting — catches missing receipts, unlogged purchases, and
            goal/note mismatches while you can still fix them.
          </p>
        )}

        {ran && flags.length === 0 && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>All clear — paperwork is consistent and complete.</span>
          </div>
        )}

        {flags.length > 0 && (
          <ul className="space-y-2">
            {flags.map((flag) => {
              const dismissed = !!dismissals[flag.key];
              const isHard = flag.severity === "hard";
              return (
                <li
                  key={flag.key}
                  className={`rounded-md border px-3 py-2 backdrop-blur ${
                    dismissed
                      ? "border-muted bg-muted/40"
                      : isHard
                        ? "border-rose-500/50 bg-rose-500/10"
                        : "border-[color:var(--amber-500)]/50 bg-[color:var(--amber-50)]/70"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isHard ? "bg-rose-600 text-white" : "bg-[color:var(--amber-600)] text-white"
                      }`}
                    >
                      {isHard ? "!" : "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium leading-snug ${
                          dismissed
                            ? "text-muted-foreground line-through"
                            : "text-[color:var(--navy-900)]"
                        }`}
                      >
                        {flag.message}
                      </p>
                      {dismissed && (
                        <p className="mt-1 text-[10px] italic text-muted-foreground">
                          Dismissed: {dismissals[flag.key]} — admin will review.
                        </p>
                      )}
                      {!dismissed && dismissingKey === flag.key && (
                        <div className="mt-2 space-y-1.5">
                          <Textarea
                            rows={2}
                            value={dismissReason}
                            onChange={(event) => onDismissReasonChange(event.target.value)}
                            placeholder="Why are you submitting without addressing this?"
                            className="min-h-[60px] text-xs"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={onCancelDismiss}
                              className="h-8 text-[11px]"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onConfirmDismiss(flag.key)}
                              className="h-8 text-[11px]"
                            >
                              Save reason
                            </Button>
                          </div>
                        </div>
                      )}
                      {!dismissed && dismissingKey !== flag.key && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onJumpToFix(flag)}
                            className="h-8 gap-1 text-[11px]"
                          >
                            {flag.fix?.route ? (
                              <ExternalLink className="h-3 w-3" />
                            ) : (
                              <Pencil className="h-3 w-3" />
                            )}
                            {flag.fix?.label ?? "Fix"}
                          </Button>
                          {!isHard && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onStartDismiss(flag.key)}
                              className="h-8 text-[11px] text-muted-foreground"
                            >
                              Dismiss with reason
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </NectarInfusionLock>
  );
}
