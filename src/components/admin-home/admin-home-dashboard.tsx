/**
 * Admin Home — decisions this week, not escalation tiles.
 * Welcome banner (AdminHomeWelcome) sits above the greeting.
 * Sits on the shared pale canvas like every other Admin page.
 */
import { Suspense, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { greetingWord, useAdminHomeData } from "@/components/admin-home/use-admin-home-data";
import { AdminHomeWelcome } from "@/components/admin-home/admin-home-welcome";
import { NectarOnboardingPanel } from "@/components/onboarding/nectar-onboarding-panel";
import { ThisWeekPlanCards } from "@/components/compliance/this-week-plan-cards";
import { generateMyReview, getReviewDayMeta, listPackWhatChanged } from "@/lib/obligations/review-pack.functions";
import {
  formatReviewDayMeta,
  isHumanPackNote,
  showWhatChangedTab,
  whatChangedTitle,
  type ReviewDayMeta,
} from "@/lib/obligations/review-pack";
import { PACK_VERSION } from "@/lib/sow-obligation-catalog-pack";
import { isAdminLevelRole } from "@/lib/obligations/escalation";
import "@/components/compliance/decision-card.css";
import "./admin-home-decisions.css";

type HomeTab = "this-week" | "review-day" | "what-changed";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--hive-muted-surface)]", className)} />;
}

function ReviewDayPanel({ orgId }: { orgId: string }) {
  const generate = useServerFn(generateMyReview);
  const loadMeta = useServerFn(getReviewDayMeta);
  const mut = useMutation({
    mutationFn: () => generate({ data: { organizationId: orgId } }),
  });
  const metaQ = useQuery({
    enabled: !!orgId,
    queryKey: ["review-day-meta", orgId],
    queryFn: () => loadMeta({ data: { organizationId: orgId } }),
    staleTime: 60_000,
  });
  const reviewText =
    mut.data?.text ??
    (mut.data as { result?: { text?: string } } | undefined)?.result?.text ??
    "";
  const metaPayload = metaQ.data as ReviewDayMeta | { result?: ReviewDayMeta } | undefined;
  const meta = metaPayload && "period" in metaPayload ? metaPayload : metaPayload?.result;
  const metaLine = meta ? formatReviewDayMeta(meta) : null;

  return (
    <section data-testid="review-day" className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight tracking-tight text-[var(--hive-text)]">
        Review day
      </h2>
      <p className="text-sm text-[var(--hive-text-muted)]">
        Draft a DSPD review from this week. A human must attest. Nothing publishes itself.
      </p>
      {metaLine ? (
        <p data-testid="review-day-meta" className="text-sm text-[var(--hive-text-muted)]">
          {metaLine}
        </p>
      ) : null}
      <Button type="button" onClick={() => mut.mutate()} disabled={mut.isPending}>
        Generate my DSPD review
      </Button>
      {mut.isPending ? (
        <p className="text-sm text-[var(--hive-text-muted)]">Generating draft.</p>
      ) : null}
      {mut.isError ? (
        <p className="text-sm text-[var(--hive-danger-fg)]">Could not generate the review.</p>
      ) : null}
      {reviewText ? (
        <pre
          data-testid="review-pack-text"
          className="whitespace-pre-wrap rounded-lg border border-[var(--hive-border)] bg-[var(--hive-surface)] p-4 font-sans text-sm text-[var(--hive-text)]"
        >
          {reviewText}
        </pre>
      ) : null}
    </section>
  );
}

function WhatChangedPanel({
  changes,
}: {
  changes: Array<{ change_kind: string; obligation_key: string; note: string | null }>;
}) {
  const notes = changes.filter((c) => isHumanPackNote(c.note));
  return (
    <section data-testid="what-changed" className="space-y-3">
      <h2 className="text-xl font-semibold leading-tight tracking-tight text-[var(--hive-text)]">
        {whatChangedTitle(PACK_VERSION)}
      </h2>
      <ul className="space-y-2">
        {notes.map((c) => (
          <li
            key={`${c.change_kind}:${c.obligation_key}`}
            className="text-sm text-[var(--hive-text)]"
          >
            {c.note!.trim()}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdminHomeDashboardInner({ welcomeFlag = false }: { welcomeFlag?: boolean }) {
  const data = useAdminHomeData();
  const { org, orgId, orgName, orgLoading, now, firstName, dateLine } = data;
  const [tab, setTab] = useState<HomeTab>("this-week");

  const canManage = org
    ? isAdminLevelRole(org.role) || org.role === "manager" || org.role === "program_manager"
    : false;

  const listChanged = useServerFn(listPackWhatChanged);
  const changedQ = useQuery({
    enabled: !!orgId && canManage,
    queryKey: ["pack-what-changed", orgId],
    queryFn: () => listChanged({ data: { organizationId: orgId! } }),
    staleTime: 60_000,
  });

  const changedPayload = changedQ.data as
    | { changes?: Array<{ change_kind: string; obligation_key: string; note: string | null }>; appliedPackVersion?: string | null; result?: { changes?: Array<{ change_kind: string; obligation_key: string; note: string | null }>; appliedPackVersion?: string | null } }
    | undefined;
  const changed = changedPayload?.changes ? changedPayload : changedPayload?.result;
  const changes = changed?.changes ?? [];
  const applied = changed?.appliedPackVersion ?? null;
  const showWhatChanged = showWhatChangedTab(changes, applied, PACK_VERSION);

  if (!orgId && !orgLoading) return null;

  const tabs: Array<{ id: HomeTab; label: string; hidden?: boolean }> = [
    { id: "this-week", label: "This week" },
    { id: "review-day", label: "Review day" },
    { id: "what-changed", label: "What changed", hidden: !showWhatChanged },
  ];
  const activeTab: HomeTab = tab === "what-changed" && !showWhatChanged ? "this-week" : tab;

  return (
    <section
      data-testid="admin-home-dashboard"
      className="relative isolate min-h-full text-[var(--hive-text)]"
    >
      <div data-testid="home-column" className="home-column relative z-10 space-y-6">
        <Suspense fallback={null}>
          <AdminHomeWelcome welcomeFlag={welcomeFlag} />
        </Suspense>
        {orgId ? <NectarOnboardingPanel welcomeFlag={welcomeFlag} /> : null}
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--hive-text)]">
            Good {greetingWord(now)}, {firstName}. Here's what needs your attention.
          </h2>
          <p className="mt-1 text-sm text-[var(--hive-text-muted)]">
            {org ? `${orgName} · ${dateLine}` : dateLine}
          </p>
        </div>

        <nav data-testid="home-tabs" className="home-tabs border-b border-[var(--hive-border)]" aria-label="Home">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={cn(
                  "home-tab",
                  activeTab === t.id
                    ? "text-[var(--hive-text)]"
                    : "text-[var(--hive-text-muted)] hover:text-[var(--hive-text)]",
                )}
                aria-selected={activeTab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
        </nav>

        {activeTab === "this-week" ? <ThisWeekPlanCards /> : null}
        {activeTab === "review-day" && orgId ? <ReviewDayPanel orgId={orgId} /> : null}
        {activeTab === "what-changed" && showWhatChanged ? <WhatChangedPanel changes={changes} /> : null}
      </div>
    </section>
  );
}

export function AdminHomeDashboard({ welcomeFlag = false }: { welcomeFlag?: boolean }) {
  return (
    <Suspense
      fallback={
        <section
          data-testid="admin-home-dashboard"
          className="relative isolate min-h-full text-[var(--hive-text)]"
        >
          <div data-testid="home-column" className="home-column relative z-10 space-y-4">
            <div>
              <div className="text-xl font-semibold tracking-tight">Good day</div>
              <div className="mt-1 text-sm text-[var(--hive-text-muted)]">Loading workspace…</div>
            </div>
            <Skeleton className="h-[220px] rounded-xl" />
          </div>
        </section>
      }
    >
      <AdminHomeDashboardInner welcomeFlag={welcomeFlag} />
    </Suspense>
  );
}
