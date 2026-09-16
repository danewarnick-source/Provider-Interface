/**
 * Admin Home welcome banner — setup chips and destination pills on the shared light surface.
 * Max ~280px on desktop. Sits above the Home greeting, not its own page.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ADMIN_HOME_CARDS,
  ADMIN_HOME_EYEBROW,
  ADMIN_HOME_HEADLINE,
  ADMIN_HOME_SUBHEAD,
} from "@/lib/admin-home-feeling";
import { dismissAdminWelcome } from "@/lib/admin-home-welcome.functions";
import { shouldShowWelcome, welcomeSetupProgress } from "@/lib/admin-home-welcome-rule";
import {
  adminHomeWelcomeQueryKey,
  useAdminHomeWelcomeCounts,
} from "@/components/admin-home/use-admin-home-welcome";

function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      className={className}
      aria-hidden
      fill="none"
    >
      <path
        d="M3.2 8.3 6.1 11.2 12.8 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      data-testid={`welcome-chip-${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        done
          ? "hive-status-active border-[var(--hive-ok)]/40"
          : "border-[var(--hive-border)] bg-[var(--hive-muted-surface)] text-[var(--hive-text-muted)]",
      )}
    >
      {done ? <CheckMark /> : <span className="h-2 w-2 rounded-full bg-[var(--hive-steel)]" aria-hidden />}
      {label}
    </span>
  );
}

export function AdminHomeWelcome({ welcomeFlag = false }: { welcomeFlag?: boolean }) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? null;
  const countsQ = useAdminHomeWelcomeCounts(orgId);
  const dismissFn = useServerFn(dismissAdminWelcome);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [hiddenNow, setHiddenNow] = useState(false);

  if (!orgId) return null;
  if (hiddenNow) return null;
  if (!countsQ.data) return null;

  const counts = countsQ.data;
  const show = shouldShowWelcome({
    orgCreatedAt: counts.orgCreatedAt,
    now: new Date(),
    welcomeDismissedAt: counts.welcomeDismissedAt,
    memberCount: counts.memberCount,
    clientCount: counts.clientCount,
    documentedShiftCount: counts.documentedShiftCount,
    welcomeFlag,
  });
  if (!show) return null;

  const progress = welcomeSetupProgress(counts);

  const hideBanner = async () => {
    setHiddenNow(true);
    try {
      await dismissFn({ data: { organizationId: orgId } });
      await queryClient.invalidateQueries({ queryKey: adminHomeWelcomeQueryKey(orgId) });
    } catch {
      /* banner already hidden; persist can retry on next visit */
    }
    void navigate({ to: "/dashboard", search: {} });
  };

  return (
    <section
      data-testid="admin-home-welcome"
      aria-label="Welcome"
      className="relative isolate overflow-hidden rounded-2xl border border-[var(--hive-border)] bg-[var(--hive-surface)] text-[var(--hive-text)] shadow-[var(--shadow-card)] lg:max-h-[280px]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{
          background:
            "radial-gradient(closest-side at 80% 20%, color-mix(in srgb, var(--hive-gold) 14%, transparent), transparent 75%)",
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--hive-text-muted)]">
              {ADMIN_HOME_EYEBROW}
            </p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-[var(--hive-text)]">
              {ADMIN_HOME_HEADLINE}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--hive-text-muted)]">
              {ADMIN_HOME_SUBHEAD}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void hideBanner()}
            className="shrink-0 text-right text-[12px] text-[var(--hive-text-muted)] underline-offset-2 hover:text-[var(--hive-text)] hover:underline"
          >
            Skip — take me to my dashboard
          </button>
        </div>

        {progress.allDone ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-[var(--hive-text)]">
              You&apos;re set up. This banner will close itself.
            </p>
            <Button type="button" onClick={() => void hideBanner()}>
              Go to my dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              <ProgressChip done={progress.inviteStaff} label="Invite staff" />
              <ProgressChip done={progress.addClient} label="Add a client" />
              <ProgressChip done={progress.documentShift} label="Document a shift" />
            </div>
            <div className="hidden gap-2 md:grid md:grid-cols-3">
              {ADMIN_HOME_CARDS.map((card) => (
                <Link
                  key={card.key}
                  to={card.to}
                  aria-label={`${card.title} — ${card.cta}`}
                  className="rounded-xl border border-[var(--hive-border)] bg-[var(--hive-canvas)] px-3 py-2.5 transition-colors hover:bg-[var(--hive-muted-surface)]"
                >
                  <div className="text-[13px] font-medium text-[var(--hive-text)]">{card.title}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--hive-text-muted)]">{card.cta}</div>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
              {ADMIN_HOME_CARDS.map((card, i) => (
                <span key={card.key} className="inline-flex items-center gap-2">
                  {i > 0 ? (
                    <span aria-hidden className="text-[var(--hive-steel)]">
                      ·
                    </span>
                  ) : null}
                  <Link
                    to={card.to}
                    className="inline-flex rounded-full border border-[var(--hive-border)] bg-[var(--hive-canvas)] px-3 py-1 text-[12px] font-medium text-[var(--hive-text)] hover:bg-[var(--hive-muted-surface)]"
                  >
                    {card.cta}
                  </Link>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
