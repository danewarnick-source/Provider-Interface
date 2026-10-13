import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { isLevelAtLeast, type AccessLevel } from "@/lib/access/levels";
import type { Permission } from "@/lib/access/permission-keys";

/** A page a blocked member is sent to instead of /unauthorized. */
type GateRedirect = "/dashboard/ask-nectar";

function useGate(
  allowed: boolean,
  isLoading: boolean,
  search?: { perm?: Permission },
  redirectTo?: GateRedirect,
) {
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoading || allowed) return;
    if (redirectTo) {
      navigate({ to: redirectTo, replace: true });
      return;
    }
    navigate({
      to: "/unauthorized",
      search: { ...search, page: typeof window !== "undefined" ? window.location.pathname : undefined },
    });
  }, [isLoading, allowed, navigate, search?.perm, redirectTo]); // eslint-disable-line react-hooks/exhaustive-deps
  return isLoading || !allowed;
}

const Loading = () => <div className="text-sm text-muted-foreground">Loading…</div>;

export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can, isLoading } = useAccess();
  const blocked = useGate(can(perm), isLoading, { perm });
  return blocked ? <Loading /> : <>{children}</>;
}

/** Hide children without redirecting. Use on edit chrome inside a viewable page. */
export function IfPermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can, isLoading } = useAccess();
  if (isLoading || !can(perm)) return null;
  return <>{children}</>;
}

/** Level gate. With `redirectTo`, a member below `min` lands there instead of /unauthorized. */
export function RequireLevel({
  min,
  redirectTo,
  children,
}: {
  min: AccessLevel;
  redirectTo?: GateRedirect;
  children: ReactNode;
}) {
  const { level, isLoading } = useAccess();
  const blocked = useGate(isLevelAtLeast(level, min), isLoading, undefined, redirectTo);
  return blocked ? <Loading /> : <>{children}</>;
}
