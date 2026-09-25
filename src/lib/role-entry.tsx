import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-org";
import { levelHome, type AccessLevel } from "@/lib/access/levels";
import { persistPortalView, resolveRoleEntryLanding, type PortalView } from "@/lib/portal-view-landing";

/** Bookmark-entry redirector: checks the user's access level, then sends them into /dashboard. */
function makeRoleEntry(allowed: AccessLevel[], persistView: PortalView | null) {
  return function RoleEntry() {
    const { session, loading } = useAuth();
    const { data: org, isLoading } = useCurrentOrg();
    const navigate = useNavigate();
    const level = org?.access.level ?? "staff";
    const home = levelHome(level, org?.access.presetHome);
    useEffect(() => {
      if (loading || isLoading) return;
      const landing = resolveRoleEntryLanding({ hasSession: !!session, level, home, allowed, persistView });
      if (landing.persistView) persistPortalView(landing.persistView);
      navigate({ to: landing.path as "/dashboard", replace: true });
    }, [loading, isLoading, session, level, home, navigate]);
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Opening {persistView === "admin" ? "Admin View" : "dashboard"}…
      </div>
    );
  };
}

export const AdminEntry = makeRoleEntry(["owner", "admin"], "admin");
export const ManagerEntry = makeRoleEntry(["owner", "admin"], "admin");
export const EmployeeEntry = makeRoleEntry(["owner", "admin", "staff"], "staff");

// Re-export createFileRoute for the route files to use.
export { createFileRoute };
