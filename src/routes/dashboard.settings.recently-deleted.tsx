import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { isOwner } from "@/lib/access/levels";
import { RecentlyDeletedList } from "@/components/settings/recently-deleted-list";

export const Route = createFileRoute("/dashboard/settings/recently-deleted")({
  component: RecentlyDeletedPage,
});

function RecentlyDeletedPage() {
  const { data: org } = useCurrentOrg();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to="/dashboard/settings"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      {!org ? null : isOwner(org.access.level) ? (
        <RecentlyDeletedList orgId={org.organization_id} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Only Owners can see recently deleted people.
        </p>
      )}
    </div>
  );
}
