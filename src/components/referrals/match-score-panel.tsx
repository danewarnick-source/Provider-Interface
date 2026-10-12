/**
 * NECTAR match score badge + expandable reasons panel.
 *
 * NECTAR PRESENTS, the provider decides. No action buttons that auto-place,
 * auto-message, or auto-anything.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Minus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getReferralMatchScore,
  recomputeReferralMatchScore,
  type MatchReason,
  type ReferralMatchScore,
  type ScoredComponent,
} from "@/lib/referral-matching.functions";

const ALL_COMPONENTS: ScoredComponent[] = [
  "location",
  "host_fit",
  "disability_fit",
  "need_fit",
  "code_overlap",
];

function scoreTone(score: number): { bg: string; text: string; label: string } {
  if (score >= 8) return { bg: "bg-acct", text: "text-accd", label: "Strong" };
  if (score >= 6) return { bg: "bg-warning-50", text: "text-warning-700", label: "Middling" };
  if (score >= 4) return { bg: "bg-warning-50", text: "text-warning-700", label: "Weak" };
  return { bg: "bg-danger-50", text: "text-danger-700", label: "Poor" };
}

function ReasonIcon({ s }: { s: MatchReason["severity"] }) {
  if (s === "positive") return <CheckCircle2 className="h-3.5 w-3.5 text-success-600" />;
  if (s === "flag") return <AlertTriangle className="h-3.5 w-3.5 text-danger-600" />;
  if (s === "negative") return <XCircle className="h-3.5 w-3.5 text-warning-600" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function SubScoreBar({
  label,
  value,
  weight,
  scored,
}: {
  label: string;
  value: number;
  weight?: number;
  scored: boolean;
}) {
  const pct = scored ? Math.max(0, Math.min(100, (value / 10) * 100)) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {label}
          {weight != null && scored && (
            <span className="ml-1 text-[10px] text-muted-foreground/70">
              (w {weight.toFixed(2)})
            </span>
          )}
        </span>
        <span className="font-mono font-medium">
          {scored ? value.toFixed(1) : <span className="text-[10px] italic text-muted-foreground">unknown</span>}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full ${scored ? "bg-primary/70" : "bg-muted-foreground/20"}`}
          style={{ width: scored ? `${pct}%` : "100%" }}
        />
      </div>
    </div>
  );
}


export function MatchScoreBadge({
  score,
  onClick,
}: {
  score: number | null | undefined;
  onClick?: () => void;
}) {
  if (score == null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary"
      >
        <Sparkles className="h-3 w-3" />…
      </button>
    );
  }
  const tone = scoreTone(score);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text} hover:ring-2 hover:ring-primary/40`}
      title={`NECTAR match — ${tone.label}`}
    >
      <Sparkles className="h-3 w-3" />
      {score.toFixed(1)}/10
    </button>
  );
}

export function MatchScorePanel({
  organizationId,
  referralId,
  defaultOpen,
}: {
  organizationId: string;
  referralId: string;
  defaultOpen?: boolean;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getReferralMatchScore);
  const recomputeFn = useServerFn(recomputeReferralMatchScore);
  const [open, setOpen] = useState(!!defaultOpen);

  const score = useQuery({
    queryKey: ["referral-match-score", referralId],
    queryFn: () =>
      getFn({
        data: { organization_id: organizationId, referral_id: referralId },
      }),
  });

  const recompute = useMutation({
    mutationFn: () =>
      recomputeFn({
        data: { organization_id: organizationId, referral_id: referralId },
      }),
    onSuccess: () => {
      toast.success("Match score recomputed");
      qc.invalidateQueries({ queryKey: ["referral-match-score", referralId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s: ReferralMatchScore | undefined = score.data;

  const scoredSet = useMemo(
    () => new Set<ScoredComponent>(s?.scored_components ?? []),
    [s],
  );
  const scoredCount = scoredSet.size;
  const totalCount = ALL_COMPONENTS.length;
  const isInsufficient = scoredCount === 0;

  const sortedReasons = useMemo(() => {
    if (!s) return [] as MatchReason[];
    const order = { flag: 0, negative: 1, positive: 2, neutral: 3 } as const;
    return [...s.reasons].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [s]);

  return (
    <div className="rounded-md border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          NECTAR match
          {s && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
              {scoredCount}/{totalCount} factors
            </span>
          )}
        </span>
        {score.isLoading ? (
          <span className="text-[11px] text-muted-foreground">computing…</span>
        ) : isInsufficient ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] italic text-muted-foreground">
            insufficient info
          </span>
        ) : (
          <MatchScoreBadge score={s?.overall_score ?? null} />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border bg-background p-3">
          {score.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : score.isError ? (
            <p className="text-xs text-danger-700">
              {(score.error as Error).message}
            </p>
          ) : s ? (
            <>
              <div
                className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                  isInsufficient
                    ? "border-warning-300 bg-warning-50 text-warning-900"
                    : scoredCount < totalCount
                      ? "border-warning-200 bg-warning-50/60 text-warning-900"
                      : "border-success-200 bg-success-50/60 text-success-900"
                }`}
              >
                {isInsufficient ? (
                  <>Not enough referral data to score — add details (location, need level, disability, codes) to compute a match.</>
                ) : (
                  <>
                    Scored on <span className="font-semibold">{scoredCount} of {totalCount}</span> factors
                    {scoredCount < totalCount && " — score based on limited info, treat as provisional."}
                  </>
                )}
              </div>

              {/* Sub-scores */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <SubScoreBar
                  label="Location fit"
                  value={s.location_fit}
                  weight={s.weights.location}
                  scored={scoredSet.has("location")}
                />
                <SubScoreBar
                  label="Host fit"
                  value={s.host_fit}
                  weight={s.weights.host_fit}
                  scored={scoredSet.has("host_fit")}
                />
                <SubScoreBar
                  label="Disability fit"
                  value={s.disability_fit}
                  weight={s.weights.disability_fit}
                  scored={scoredSet.has("disability_fit")}
                />
                <SubScoreBar
                  label="Need fit"
                  value={s.need_fit}
                  weight={s.weights.need_fit}
                  scored={scoredSet.has("need_fit")}
                />
                <SubScoreBar
                  label="Code overlap"
                  value={s.code_overlap}
                  weight={s.weights.code_overlap}
                  scored={scoredSet.has("code_overlap")}
                />
              </div>


              {/* Best host ids */}
              {s.best_host_ids.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Best-fit host{s.best_host_ids.length > 1 ? "s" : ""}:{" "}
                  {s.best_host_ids.map((id) => (
                    <Badge
                      key={id}
                      variant="outline"
                      className="ml-1 font-mono text-[10px]"
                    >
                      {id.slice(0, 8)}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Reasons */}
              <div>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                  NECTAR reasons
                </div>
                <ul className="space-y-1.5">
                  {sortedReasons.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs leading-snug"
                    >
                      <span className="mt-0.5 shrink-0">
                        <ReasonIcon s={r.severity} />
                      </span>
                      <span
                        className={
                          r.severity === "flag"
                            ? "font-medium text-danger-900"
                            : ""
                        }
                      >
                        {r.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2">
                <p className="text-[10px] italic text-muted-foreground">
                  NECTAR presents — the provider decides. Nothing is
                  auto-placed.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => recompute.mutate()}
                  disabled={recompute.isPending}
                >
                  <RefreshCw
                    className={`h-3 w-3 ${recompute.isPending ? "animate-spin" : ""}`}
                  />
                  Recompute
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
