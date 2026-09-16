import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import {
  formatEta,
  useDraftJobsSummary,
} from "@/components/nectar/draft-jobs-driver";

// Small header pill shown while any NECTAR draft-requirement job is
// running. Persists across dashboard pages so users know work is still
// happening after they navigate away from Authoritative Sources.
export function DraftJobsHeaderPill() {
  const { activeCount, minEtaMs } = useDraftJobsSummary();
  if (activeCount === 0) return null;
  const etaLabel = formatEta(minEtaMs);
  return (
    <Link
      to="/dashboard/authoritative-sources"
      className="hive-chrome-btn h-10 px-3 text-xs font-semibold"
      title="NECTAR is drafting requirements from your authoritative sources"
    >
      <Sparkles className="h-3.5 w-3.5 animate-pulse text-[var(--hive-gold)]" />
      <span>
        Drafting {activeCount} source{activeCount === 1 ? "" : "s"}
      </span>
      {etaLabel && (
        <span className="hidden opacity-80 sm:inline">· {etaLabel}</span>
      )}
    </Link>
  );
}
