// Profile layout shared by person profiles (Team members and Clients).
// Generic on purpose: no team-member imports.
//
// Desktop (768px and up) inside the dashboard: the dark main sidebar becomes
// this person's section menu (sidebar-takeover.tsx; drawn by the dashboard
// layout), and the page content uses the full width. Under 768px: a
// horizontal scroll row of pills above the content. Outside the dashboard
// (no takeover) the desktop menu is a white card on the left instead.
// Also an attention strip / pill and an optional right-side Sheet panel.
// Theme tokens only.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TONE_TAG, TONE_TILE, type ProfileTone } from "./tones";
import {
  useHasSidebarTakeover,
  useIsDesktop,
  useSidebarTakeover,
  type SidebarProfile,
} from "./sidebar-takeover";

export type ProfileShellBadgeTone = "bad" | "warn" | "ok" | "muted";

export type ProfileShellSection<K extends string = string> = {
  key: K;
  label: string;
  icon: LucideIcon;
  /** Tints the icon tile; neutral when left out. */
  tone?: ProfileTone;
  badge?: { count: number; tone: ProfileShellBadgeTone } | null;
  visible: boolean;
};

const BADGE_TONE: Record<ProfileShellBadgeTone, string> = {
  bad: TONE_TAG.danger,
  warn: TONE_TAG.warn,
  ok: TONE_TAG.ok,
  muted: TONE_TAG.neutral,
};

function SectionBadge({ badge }: { badge: ProfileShellSection["badge"] }) {
  if (!badge || badge.count <= 0) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold tabular-nums",
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
  sidebar,
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
  /** The back link and the person shown at the top of the sidebar menu (desktop). */
  sidebar?: Pick<SidebarProfile, "back" | "person">;
}) {
  const shown = sections.filter((s) => s.visible);
  const onHome = attentionHomeKey === undefined || activeKey === attentionHomeKey;
  const canTakeOver = useHasSidebarTakeover() && !!sidebar;
  const desktop = useIsDesktop();
  const inSidebar = canTakeOver && desktop === true;
  useSidebarTakeover(
    inSidebar && sidebar
      ? {
          ...sidebar,
          sections: shown.map(({ key, label, icon, badge }) => ({ key, label, icon, badge })),
          activeKey,
          onSelect: (key) => onSelect(key as K),
        }
      : null,
  );

  return (
    <div className="min-w-0 max-w-full space-y-5" data-testid="profile-shell">
      {header}

      <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-start">
        {/* On desktop in the dashboard the menu is in the sidebar instead (never both). */}
        {inSidebar ? null : (
          <nav
            aria-label="Profile sections"
            className={cn(
              "min-w-0 md:sticky md:top-4 md:w-[236px] md:shrink-0",
              canTakeOver && "md:hidden",
            )}
            data-testid="profile-section-menu"
          >
            {/* Phone: one scrolling row. Desktop: a card with a vertical list. */}
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:rounded-[var(--denim-r)] md:border md:border-line md:bg-paper md:p-2 md:shadow-[var(--denim-shadow-sm)]">
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
                        "flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-full border px-2 py-1.5 pr-3.5 text-left text-sm text-deep transition-colors md:border-transparent md:pr-2",
                        active
                          ? "border-pt2 bg-pt font-semibold text-pri"
                          : "border-line bg-paper hover:bg-pt0 md:bg-transparent",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                          TONE_TILE[s.tone ?? "neutral"],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{s.label}</span>
                      <SectionBadge badge={s.badge} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className="min-w-0 flex-1 space-y-5" data-testid="profile-section-content">
          {attentionCount > 0 ? (
            onHome ? (
              attention
            ) : attentionHomeKey !== undefined ? (
              <button
                type="button"
                onClick={() => onSelect(attentionHomeKey)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:underline max-md:min-h-11",
                  TONE_TAG.warn,
                )}
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
