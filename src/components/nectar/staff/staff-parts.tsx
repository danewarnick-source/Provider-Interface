// Pieces of team member Nectar's Policies tab and read-only views (N6).
// The staff phone shell gives /dashboard/ask-nectar a main area that does not
// scroll, so each view scrolls itself and keeps clear of the bottom tabs and
// the clocked-in bar.

import type { ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMobileShellContainer } from "@/components/staff-mobile/mobile-shell-context";
import { useActiveShiftBarVisible } from "@/hooks/use-active-shift-bar";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { staffMainBottomPadCss } from "@/lib/staff-phone-chrome";

export function StaffScroll({ children }: { children: ReactNode }) {
  const { container } = useMobileShellContainer();
  const barVisible = useActiveShiftBarVisible();
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3"
      style={{ paddingBottom: container ? staffMainBottomPadCss(barVisible) : "1rem" }}
    >
      {children}
    </div>
  );
}

export function StaffLoading() {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
    </p>
  );
}

/** A read that failed or was refused: say so plainly, no spinner. */
export function StaffError({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
    >
      {safeErrorMessage(error, fallback)}
    </div>
  );
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--hive-text)]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
    </button>
  );
}
