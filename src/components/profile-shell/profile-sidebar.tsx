// The dark main sidebar while a person profile is open on desktop (Option A):
// the PI logo (Home), "← All clients" / "← All team members", the person's
// photo or initials, name and one line, then the profile sections with the
// sidebar's own active and hover styles, and the usual user / org / sign-out
// footer (passed in by the dashboard layout). Data from sidebar-takeover.tsx.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PiBrand } from "@/components/brand/pi-brand";
import { PersonAvatar } from "@/components/person/person-avatar";
import { cn } from "@/lib/utils";
import type { SidebarProfile, SidebarProfileBadgeTone } from "./sidebar-takeover";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-0";
const ITEM_IDLE = "text-ondark hover:bg-white/6 hover:text-white [&_svg]:text-ondarkp";

const BADGE_TONE: Record<SidebarProfileBadgeTone, string> = {
  bad: "bg-danger-600 text-white",
  warn: "bg-warning-600 text-white",
  ok: "bg-acc text-white",
  muted: "bg-white/15 text-ondark",
};

export function ProfileSidebar({
  profile,
  footer,
}: {
  profile: SidebarProfile;
  footer: ReactNode;
}) {
  const { back, person, sections, activeKey, onSelect } = profile;
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <PiBrand to="/dashboard" tone="chrome" size="md" stacked />
      </div>

      <div className="shrink-0 space-y-3 border-b border-sidebar-border px-3 py-3">
        <Link
          // The two list routes; typed loosely so the profile decides which.
          to={back.to as "/dashboard/clients"}
          search={back.search as never}
          onClick={back.onClick}
          className={cn(
            "flex items-center gap-3 rounded-full py-2 pl-6 pr-3 text-sm font-medium transition-colors",
            ITEM_IDLE,
            FOCUS,
          )}
          data-testid={back.testId ?? "profile-sidebar-back"}
        >
          <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
          {back.label}
        </Link>
        <div className="flex min-w-0 items-center gap-3 px-3" data-testid="profile-sidebar-person">
          <PersonAvatar
            bucket={person.photo.bucket}
            path={person.photo.path}
            name={person.name}
            className="h-11 w-11 shrink-0 border-white/20 bg-white/12 text-ondark"
          />
          <div className="min-w-0">
            <p
              className="truncate font-display text-sm font-semibold text-white"
              title={person.name}
            >
              {person.name}
            </p>
            {person.subline ? (
              <p
                className="truncate text-xs text-ondarkp/80"
                title={person.subline}
                data-testid="profile-sidebar-subline"
              >
                {person.subline}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        aria-label="Profile sections"
        className="flex-1 overflow-y-auto p-3"
        data-testid="profile-section-menu"
      >
        <ul className="space-y-1">
          {sections.map((s) => {
            const active = s.key === activeKey;
            const Icon = s.icon;
            const count = s.badge && s.badge.count > 0 ? s.badge.count : 0;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onSelect(s.key)}
                  aria-current={active ? "page" : undefined}
                  data-testid={`profile-section-${s.key}`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-full py-2 pl-6 pr-3 text-left text-sm transition-colors",
                    active ? "hive-nav-active" : ITEM_IDLE,
                    FOCUS,
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="flex-1">{s.label}</span>
                  {count > 0 && s.badge ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none",
                        active ? "bg-white text-pri" : BADGE_TONE[s.badge.tone],
                      )}
                      data-testid="profile-section-badge"
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {footer}
    </>
  );
}
