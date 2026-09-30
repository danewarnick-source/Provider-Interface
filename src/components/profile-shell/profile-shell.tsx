// Profile layout shared by person profiles (Team members now, Clients later).
// Generic on purpose: no team-member imports. Left section menu (236px card)
// on desktop, a horizontal scroll row under 768px, an attention strip, and an
// optional right-side Sheet panel. Theme tokens only.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export type ProfileShellBadgeTone = "bad" | "warn" | "ok" | "muted";

export type ProfileShellSection<K extends string = string> = {
  key: K;
  label: string;
  icon: LucideIcon;
  badge?: { count: number; tone: ProfileShellBadgeTone } | null;
  visible: boolean;
};

const BADGE_TONE: Record<ProfileShellBadgeTone, string> = {
  bad: "bg-destructive/10 text-destructive",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  muted: "bg-muted text-muted-foreground",
};

function SectionBadge({ badge }: { badge: ProfileShellSection["badge"] }) {
  if (!badge || badge.count <= 0) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
        BADGE_TONE[badge.tone],
      )}
      data-testid="profile-section-badge"
    >
      {badge.count}
    </span>
  );
}

export function ProfileShell<K extends string>({
  header,
  attention,
  attentionCount = 0,
  attentionHomeKey,
  sections,
  activeKey,
  onSelect,
  children,
  panel,
  onPanelClose,
}: {
  header: ReactNode;
  /** Full attention strip, drawn on the home section (attentionHomeKey). */
  attention: ReactNode | null;
  /** How many things need attention; drives the compact pill elsewhere. 0 hides both. */
  attentionCount?: number;
  /** The section the full strip lives on (and the pill jumps to). */
  attentionHomeKey?: K;
  sections: ProfileShellSection<K>[];
  activeKey: K;
  onSelect: (key: K) => void;
  children: ReactNode;
  /** Right-side Sheet content; null keeps it closed. */
  panel: ReactNode | null;
  onPanelClose?: () => void;
}) {
  const shown = sections.filter((s) => s.visible);
  const onHome = attentionHomeKey === undefined || activeKey === attentionHomeKey;

  return (
    <div className="min-w-0 max-w-full space-y-4" data-testid="profile-shell">
      {header}

      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start">
        <nav
          aria-label="Profile sections"
          className="min-w-0 md:sticky md:top-4 md:w-[236px] md:shrink-0"
          data-testid="profile-section-menu"
        >
          {/* Phone: one scrolling row. Desktop: a card with a vertical list. */}
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:rounded-lg md:border md:bg-card md:p-2 md:shadow-sm">
            {shown.map((s) => {
              const active = s.key === activeKey;
              const Icon = s.icon;
              return (
                <li key={s.key} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => onSelect(s.key)}
                    aria-current={active ? "page" : undefined}
                    data-testid={`profile-section-${s.key}`}
                    className={cn(
                      "relative flex w-full items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm transition-colors md:border-0",
                      active
                        ? "border-border bg-muted font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-hive-gold md:inset-x-auto md:inset-y-1.5 md:left-0 md:h-auto md:w-[3px]"
                      />
                    ) : null}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{s.label}</span>
                    <SectionBadge badge={s.badge} />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-4" data-testid="profile-section-content">
          {attentionCount > 0 ? (
            onHome ? (
              attention
            ) : attentionHomeKey !== undefined ? (
              <button
                type="button"
                onClick={() => onSelect(attentionHomeKey)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:underline dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                data-testid="profile-attention-pill"
              >
                {attentionCount} {attentionCount === 1 ? "thing needs" : "things need"} attention
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null
          ) : null}
          {children}
        </div>
      </div>

      <Sheet open={panel !== null} onOpenChange={(open) => (!open ? onPanelClose?.() : undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
