import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { ClientListRow } from "@/lib/clients/list";
import {
  LIST_SHORTCUTS,
  canFixSection,
  type ListShortcutKey,
  type ListViewer,
} from "@/lib/clients/list-display";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";

/** Small link into one section of the client's profile; never also opens the row. */
export function SectionLink({
  clientId,
  section,
  children,
  className,
}: {
  clientId: string;
  section: ClientProfileSection;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to="/dashboard/clients/$clientId"
      params={{ clientId }}
      search={{ section }}
      data-no-row-nav
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex min-h-6 items-center rounded-sm text-xs font-medium text-[var(--hive-info-fg)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * An empty cell: "+ Add codes" (etc.) when the viewer can open and edit the
 * section that fixes it, otherwise the plain fallback text.
 */
export function EmptyCell({
  row,
  viewer,
  shortcut,
  fallback,
}: {
  row: ClientListRow;
  viewer: ListViewer;
  shortcut: ListShortcutKey | null;
  fallback: string;
}) {
  const s = shortcut ? LIST_SHORTCUTS[shortcut] : null;
  if (!s || row.kind !== "client" || !canFixSection(s.section, viewer)) {
    return <span className="text-xs text-muted-foreground">{fallback}</span>;
  }
  return (
    <SectionLink clientId={row.id} section={s.section}>
      {s.label}
    </SectionLink>
  );
}
