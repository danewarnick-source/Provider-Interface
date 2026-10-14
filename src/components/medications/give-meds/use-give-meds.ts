import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGiveMeds } from "@/lib/medications/give-meds.functions";
import {
  asNeededMeds,
  dueDoses,
  followupsDue,
  loggedOnDay,
  type DueDose,
  type GiveLog,
  type GiveMed,
} from "@/lib/medications/give-meds";
import { denverYmd } from "@/lib/denver-date";

export interface GiveMedsWindow {
  start?: string | null;
  end?: string | null;
}

/** Give meds data for one client and day, with the lists the screen shows. */
export function useGiveMeds(clientId: string, day?: string, window?: GiveMedsWindow) {
  const load = useServerFn(getGiveMeds);
  const qc = useQueryClient();
  const theDay = day ?? denverYmd();
  const q = useQuery({
    queryKey: ["give-meds", clientId, theDay],
    queryFn: () => load({ data: { clientId, day: theDay } }),
    enabled: !!clientId,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const wStart = window?.start ?? null;
  const wEnd = window?.end ?? null;
  const lists = useMemo(() => {
    const win = { start: wStart, end: wEnd };
    const meds: GiveMed[] = q.data?.meds ?? [];
    const logs: GiveLog[] = q.data?.logs ?? [];
    const now = new Date();
    // An overnight shift can start the day before: list that day's doses too.
    const startDay = wStart ? denverYmd(new Date(wStart)) : theDay;
    const days = startDay < theDay ? [startDay, theDay] : [theDay];
    const due: DueDose[] = days.flatMap((d) => dueDoses(meds, logs, d, win));
    return {
      meds,
      logs,
      due,
      /** Due doses whose time has come (these hold up clock-out and the daily note). */
      dueByNow: due.filter((d) => Date.parse(d.scheduledFor) <= now.getTime()),
      asNeeded: asNeededMeds(meds),
      followups: followupsDue(logs, now),
      logged: loggedOnDay(logs, theDay),
    };
    // q.dataUpdatedAt re-runs the lists each minute so "due by now" moves on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, q.dataUpdatedAt, theDay, wStart, wEnd]);

  return {
    ...lists,
    day: theDay,
    loading: q.isLoading,
    error: q.error as Error | null,
    clientFirstName: q.data?.clientFirstName ?? "",
    training: q.data?.training ?? "approved",
    isAdmin: q.data?.isAdmin ?? false,
    refresh: () => qc.invalidateQueries({ queryKey: ["give-meds", clientId] }),
  };
}

export type GiveMedsState = ReturnType<typeof useGiveMeds>;
