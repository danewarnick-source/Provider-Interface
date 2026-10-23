// Lets a page take over the dashboard's dark sidebar (Option A on person
// profiles): while a client or team member profile is open on desktop, the
// sidebar shows that person's section menu instead of the main menu. The
// dashboard layout owns the state (SidebarTakeoverProvider) and draws it;
// ProfileShell sends its sections with useSidebarTakeover and releases them
// when it closes, so every other page keeps the normal menu.
//
// Two contexts on purpose: pages only read the (stable) setter, so a page
// sending a new menu never re-renders itself, only the sidebar.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type SidebarProfileBadgeTone = "bad" | "warn" | "ok" | "muted";

export interface SidebarProfileSection {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: { count: number; tone: SidebarProfileBadgeTone } | null;
}

export interface SidebarProfile {
  /** "← All clients" / "← All team members": back to the list as it was left. */
  back: {
    label: string;
    to: "/dashboard/clients" | "/dashboard/team-members";
    search?: Record<string, unknown>;
    onClick?: () => void;
    testId?: string;
  };
  person: {
    name: string;
    /** One line under the name (clients: codes · home; team members: job title). */
    subline: string | null;
    photo: { bucket: "client-photos" | "staff-photos"; path: string | null };
  };
  /** The visible sections, in order. */
  sections: SidebarProfileSection[];
  activeKey: string;
  onSelect: (key: string) => void;
}

type Setter = (profile: SidebarProfile | null) => void;

const SetterContext = createContext<Setter | null>(null);
const ValueContext = createContext<SidebarProfile | null>(null);

export function SidebarTakeoverProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  return (
    <SetterContext.Provider value={setProfile}>
      <ValueContext.Provider value={profile}>{children}</ValueContext.Provider>
    </SetterContext.Provider>
  );
}

/** The profile menu the sidebar should show, or null for the normal menu. */
export function useSidebarProfile(): SidebarProfile | null {
  return useContext(ValueContext);
}

/** True inside a layout whose sidebar can be taken over. */
export function useHasSidebarTakeover(): boolean {
  return useContext(SetterContext) !== null;
}

/**
 * Send `profile` to the sidebar (null releases it). Released when the
 * component unmounts. A no-op outside SidebarTakeoverProvider.
 */
export function useSidebarTakeover(profile: SidebarProfile | null): void {
  const set = useContext(SetterContext);
  // Every render: sections, badges and the active key change as the page does.
  useEffect(() => {
    set?.(profile);
  });
  useEffect(() => () => set?.(null), [set]);
}

const DESKTOP_QUERY = "(min-width: 768px)";

/** 768px and up; undefined until mounted (no window on the server). */
export function useIsDesktop(): boolean | undefined {
  const [desktop, setDesktop] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return desktop;
}
