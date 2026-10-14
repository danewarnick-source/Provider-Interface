import { createFileRoute } from "@tanstack/react-router";
import { StaffNectarPage } from "@/components/nectar/staff/staff-nectar-page";
import { FeatureGate } from "@/components/upgrade-gate";
import { parseStaffNectarSearch } from "@/lib/nectar/nectar-nav";

export const Route = createFileRoute("/dashboard/ask-nectar")({
  head: () => ({ meta: [{ title: "Ask Nectar — Provider Interface" }] }),
  // ?tab=policies, ?doc= (a policy), ?section= (a cited state rule section), ?q= (asked once).
  validateSearch: (s: Record<string, unknown>) => parseStaffNectarSearch(s),
  component: AskNectarStaffPage,
});

function AskNectarStaffPage() {
  return (
    <FeatureGate featureKey="nectar">
      {/*
        Staff phone main for this route has no px/py (shell overflow-hidden).
        Do not use negative vertical margin — that pulled the thread under the title bar / iOS
        safe area. Page-level padding only; chrome components stay untouched.
      */}
      <div
        data-ask-nectar-page
        className="flex h-full min-h-0 flex-col overflow-hidden overscroll-none bg-card pt-2 md:mx-auto md:h-[calc(100vh-8rem)] md:w-full md:max-w-3xl md:rounded-2xl md:border md:border-border md:pt-0 md:shadow-[var(--shadow-card)]"
      >
        <StaffNectarPage />
      </div>
    </FeatureGate>
  );
}
