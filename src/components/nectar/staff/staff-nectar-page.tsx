// Team member Nectar on /dashboard/ask-nectar (N6, as in the demo): Ask and
// Policies as two tabs at the top of the page (the staff bottom tabs are
// unchanged). A policy (?doc=) or a cited state rule section (?section=)
// opens read-only in place; Back returns to the tab it was opened from.

import type { ReactNode } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-org";
import { needsReviewCount } from "@/lib/nectar/library/staff-policies";
import { staffNectarView, type StaffNectarSearch } from "@/lib/nectar/nectar-nav";
import { cn } from "@/lib/utils";
import { StaffAskTab } from "./staff-ask-tab";
import { StaffPoliciesTab } from "./staff-policies-tab";
import { StaffPolicyView } from "./staff-policy-view";
import { StaffSectionView } from "./staff-section-view";
import { useMyPolicies } from "./use-staff-policies";

const askNectarRoute = getRouteApi("/dashboard/ask-nectar");

export function StaffNectarPage() {
  const search = askNectarRoute.useSearch();
  const navigate = askNectarRoute.useNavigate();
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? null;
  const needs = needsReviewCount(useMyPolicies(orgId).data?.policies ?? []);
  const view = staffNectarView(search);
  const go = (next: StaffNectarSearch) => void navigate({ search: next });
  const back = () => go(view.tab === "policies" ? { tab: "policies" } : {});

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Nectar"
        className="grid shrink-0 grid-cols-2 border-b border-border px-2"
      >
        <TabButton active={view.tab === "ask"} onClick={() => go({})}>
          Ask
        </TabButton>
        <TabButton active={view.tab === "policies"} onClick={() => go({ tab: "policies" })}>
          Policies
          {needs > 0 ? (
            <span
              aria-label={`${needs} to review`}
              className="ml-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--hive-gold)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
            >
              {needs}
            </span>
          ) : null}
        </TabButton>
      </div>
      {view.kind === "policy" ? (
        <StaffPolicyView orgId={orgId} documentId={view.documentId} onBack={back} />
      ) : view.kind === "section" ? (
        <StaffSectionView orgId={orgId} sectionId={view.sectionId} onBack={back} />
      ) : view.tab === "policies" ? (
        <StaffPoliciesTab orgId={orgId} onOpen={(doc) => go({ tab: "policies", doc })} />
      ) : (
        <StaffAskTab
          initialQuestion={search.q}
          onAsked={() =>
            void navigate({ search: (prev) => ({ ...prev, q: undefined }), replace: true })
          }
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex min-h-[44px] items-center justify-center text-sm font-semibold transition-colors",
        active
          ? "text-[var(--hive-text)] after:absolute after:inset-x-6 after:-bottom-px after:h-[3px] after:rounded-full after:bg-[var(--hive-gold)]"
          : "text-muted-foreground hover:text-[var(--hive-text)]",
      )}
    >
      {children}
    </button>
  );
}
