// Client profile layout: the shared person-profile shell (side menu, phone
// scroll row, attention pill) with the client sections. Sections the viewer
// can't open are hidden; each section shows how many items need attention.

import type { ReactNode } from "react";
import {
  Activity,
  ClipboardList,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  Receipt,
  User,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ProfileShell, type ProfileShellSection } from "@/components/profile-shell/profile-shell";
import {
  CLIENT_PROFILE_SECTIONS,
  CLIENT_SECTION_LABEL,
  type ClientProfileSection,
} from "@/lib/clients/profile-sections";

const SECTION_ICON: Record<ClientProfileSection, LucideIcon> = {
  overview: LayoutDashboard,
  profile: User,
  contacts: UsersRound,
  health: HeartPulse,
  plans: ClipboardList,
  services: Receipt,
  money: Wallet,
  file: FolderOpen,
  team: Users,
  activity: Activity,
};

export function ClientProfileShell({
  header,
  visible,
  attentionCounts,
  attentionTotal,
  active,
  onSelect,
  children,
}: {
  header: ReactNode;
  visible: readonly ClientProfileSection[];
  attentionCounts: ReadonlyMap<ClientProfileSection, number>;
  attentionTotal: number;
  active: ClientProfileSection;
  onSelect: (section: ClientProfileSection) => void;
  children: ReactNode;
}) {
  const sections: ProfileShellSection<ClientProfileSection>[] = CLIENT_PROFILE_SECTIONS.map(
    (key) => {
      const count = key === "overview" ? 0 : (attentionCounts.get(key) ?? 0);
      return {
        key,
        label: CLIENT_SECTION_LABEL[key],
        icon: SECTION_ICON[key],
        visible: visible.includes(key),
        badge: count > 0 ? { count, tone: "warn" as const } : null,
      };
    },
  );
  return (
    <ProfileShell
      header={header}
      attention={null}
      attentionCount={attentionTotal}
      attentionHomeKey="overview"
      sections={sections}
      activeKey={active}
      onSelect={onSelect}
      panel={null}
    >
      {children}
    </ProfileShell>
  );
}
