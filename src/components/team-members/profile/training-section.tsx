// Training section — read-only list of this person's course assignments and
// certificates, from what the HIVE Training pages already read
// (getMemberTraining). No writes here.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { getMemberTraining, memberTrainingQueryKey } from "@/lib/team-members/overview.functions";

function day(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  expired: "Expired",
};

export function TrainingSection({ orgId, staffId }: { orgId: string; staffId: string }) {
  const loadFn = useServerFn(getMemberTraining);
  const q = useQuery({
    queryKey: memberTrainingQueryKey(orgId, staffId),
    queryFn: () => loadFn({ data: { organizationId: orgId, staffUserId: staffId } }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading training…</p>;
  if (q.isError || !q.data) {
    return (
      <p className="text-sm text-destructive">
        Couldn't load training: {safeErrorMessage(q.error, "please try again.")}
      </p>
    );
  }
  const { courses, certificates } = q.data;

  return (
    <div className="space-y-4" data-testid="profile-training">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Course assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No HIVE Training courses assigned.</p>
          ) : (
            <ul className="divide-y text-sm">
              {courses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABEL[c.status] ?? c.status}
                    {c.progressPct != null && !c.completedAt ? ` · ${c.progressPct}%` : ""}
                    {c.completedAt ? ` · completed ${day(c.completedAt)}` : ""}
                    {c.expiresAt ? ` · expires ${day(c.expiresAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No certificates on file in HIVE Training.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {certificates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.source} · {day(c.issuedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Hour tracking comes with the training update. Training certificates uploaded as evidence are
        on the Team member file.
      </p>
    </div>
  );
}
