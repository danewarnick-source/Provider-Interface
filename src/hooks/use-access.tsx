import { useAuth } from "./use-auth";
import { useCurrentOrg } from "./use-org";
import { hasCategory, hasPermission } from "@/lib/access/can";
import type { CategoryId } from "@/lib/access/categories";
import { isAdminLevel, isAgencyAdmin, isOwner } from "@/lib/access/levels";
import { isCommitteeOnly } from "@/lib/access/member";
import type { Permission } from "@/lib/access/permission-keys";

/** The signed-in member's access in the active org. Replaces the old role matrix. */
export function useAccess() {
  const { user, loading: authLoading } = useAuth();
  const orgQ = useCurrentOrg();
  const access = orgQ.data?.access ?? null;

  // Disabled queries report isLoading=false in TanStack v5; treat "user but no answer yet" as loading.
  const isLoading = authLoading || (!!user && orgQ.data === undefined && !orgQ.isError);

  return {
    access,
    level: access?.level ?? null,
    scope: access?.scope ?? null,
    isOwner: isOwner(access?.level),
    isAdminLevel: isAdminLevel(access?.level),
    isAgencyAdmin: isAgencyAdmin(access?.level, access?.scope),
    isCommitteeOnly: isCommitteeOnly(access),
    can: (perm: Permission): boolean => !!access && hasPermission(access.categories, perm),
    canCategory: (id: CategoryId, min: "view" | "edit" = "view"): boolean =>
      !!access && hasCategory(access.categories, id, min),
    isLoading,
  };
}
