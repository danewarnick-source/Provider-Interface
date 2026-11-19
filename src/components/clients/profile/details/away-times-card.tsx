// Away times on the client's profile (B7, RHS clients): where they are on
// their standard week (day program, job, school, another provider), with
// + Add away time and Remove. When every resident of their home is away,
// those hours need no staff on the schedule. Clients edit to change.
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import type { AwayTime } from "@/lib/clients/away-times";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { AddAwayTime, AwayTimesList } from "@/components/clients/shared/away-times-list";
import { useCoverageActions } from "@/components/scheduler/home/use-coverage-actions";

export function AwayTimesCard({ orgId, clientId }: { orgId: string; clientId: string }) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const act = useCoverageActions(orgId);
  const q = useQuery({
    queryKey: ["client-away-times", orgId, clientId],
    queryFn: async (): Promise<AwayTime[]> => {
      const { data, error } = await supabase
        .from("client_away_times")
        .select("id, client_id, weekday_mask, start_time, end_time, label, note")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .is("archived_at", null)
        .order("start_time");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  return (
    <SectionCard
      icon={CalendarClock}
      title="Away times"
      description="Their standard week away from the home: day program, job, school, another provider. Not billed."
      actions={canEdit ? <AddAwayTime clientId={clientId} act={act} /> : undefined}
      testId="client-away-times"
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-[var(--hive-danger)]">
          Away times didn't load: {q.error.message}. Reload the page to try again.
        </p>
      ) : (
        <AwayTimesList clientId={clientId} away={q.data ?? []} canEdit={canEdit} act={act} />
      )}
    </SectionCard>
  );
}
