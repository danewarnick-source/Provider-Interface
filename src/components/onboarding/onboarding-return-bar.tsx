import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAgencySetup } from "@/hooks/use-agency-setup";
import { AGENCY_SETUP_PATH } from "@/lib/agency-setup-gate";

/**
 * Persistent slim bar on destination pages while server setup is incomplete.
 * Progress is the six saved operating facts — not localStorage step flags.
 */
export function OnboardingReturnBar() {
  const { status, orgId } = useAgencySetup();
  const search = useSearch({ strict: false }) as { from?: string } | undefined;
  const fromOnboarding = search?.from === "onboarding";

  if (!orgId) return null;
  if (status.complete && !fromOnboarding) return null;

  return (
    <div className="sticky top-0 z-40 -mx-4 mb-3 border-b border-amber-300/40 bg-[#0b1733]/95 px-4 py-2 text-amber-50 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
      <Link
        to={AGENCY_SETUP_PATH}
        search={{ reason: "setup_incomplete" } as never}
        className="flex items-center justify-between gap-3 text-sm"
      >
        <span className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4 text-[color:var(--amber-400,var(--hive-gold))]" />
          <span className="font-medium">Back to agency setup</span>
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-amber-100/90">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--amber-400,var(--hive-gold))]" />
          <span className="tabular-nums">
            {status.progressLabel} operating facts
          </span>
        </span>
      </Link>
    </div>
  );
}
