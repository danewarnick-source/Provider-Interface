// Give meds: the one component staff use to log doses (MAR tab, clock-out check
// and HHS daily note).

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Pill } from "lucide-react";
import { asTrainingStatus, trainingNotice } from "@/lib/medications/med-training";
import { clockTime, LATE_DOSE_MINUTES, prnStatus, prnWarning } from "@/lib/medications/give-meds";
import { DoseRow } from "./dose-row";
import { FollowupCard } from "./followup-card";
import { GiveDoseDialog, type GiveTarget, type PassContext } from "./give-dose-dialog";
import { LoggedDoses } from "./logged-doses";
import { NotGivenDialog } from "./not-given-dialog";
import { useGiveMeds, type GiveMedsWindow } from "./use-give-meds";

export interface GiveMedsStatus {
  loading: boolean;
  /** Scheduled doses whose time has come and nobody has logged. */
  dueByNow: number;
  /** PRN follow-ups due (a reminder, never a block). */
  followupsDue: number;
}

/**
 * The one place staff log doses: on the staff workspace MAR tab, in the
 * clock-out check and in the HHS daily note. Due now and As needed are listed
 * apart; PRN follow-ups that are due show at the top.
 */
export function GiveMeds({
  clientId,
  day,
  window,
  serviceContext,
  scheduledShiftId,
  showLogged = true,
  onStatus,
}: {
  clientId: string;
  /** Denver day (YYYY-MM-DD); today when omitted. */
  day?: string;
  /** Only doses due inside this window are listed (clock-out: clock-in to now). */
  window?: GiveMedsWindow;
  serviceContext?: string | null;
  scheduledShiftId?: string | null;
  showLogged?: boolean;
  onStatus?: (s: GiveMedsStatus) => void;
}) {
  const g = useGiveMeds(clientId, day, window);
  const [give, setGive] = useState<GiveTarget | null>(null);
  const [notGiven, setNotGiven] = useState<GiveTarget | null>(null);
  const ctx: PassContext = { clientId, serviceContext, scheduledShiftId };
  const training = asTrainingStatus(g.training);
  const notice = trainingNotice(training, g.isAdmin);
  const medById = new Map(g.meds.map((m) => [m.id, m]));

  useEffect(() => {
    onStatus?.({
      loading: g.loading,
      dueByNow: g.dueByNow.length,
      followupsDue: g.followups.length,
    });
  }, [onStatus, g.loading, g.dueByNow.length, g.followups.length]);

  const startGive = (t: GiveTarget) => setGive(t);

  const saved = () => {
    setGive(null);
    setNotGiven(null);
    void g.refresh();
  };

  if (g.loading) return <p className="text-sm text-muted-foreground">Loading medications…</p>;
  if (g.error) return <p className="text-sm text-rose-600">{g.error.message}</p>;

  const now = Date.now();
  return (
    <div className="space-y-4">
      {notice ? (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {notice.text}{" "}
            {notice.href ? (
              <Link to={notice.href} className="font-medium underline">
                Open Evidence
              </Link>
            ) : null}
          </p>
        </div>
      ) : null}

      {g.followups.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Follow-ups due</h3>
          <ul className="space-y-2">
            {g.followups.map((l) => (
              <FollowupCard
                key={l.id}
                log={l}
                med={l.medication_id ? medById.get(l.medication_id) : undefined}
                onSaved={saved}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Pill className="h-4 w-4" /> Due now
        </h3>
        {g.due.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No scheduled doses left to log.</p>
        ) : (
          <ul className="divide-y">
            {g.due.map((d) => (
              <DoseRow
                key={`${d.med.id}|${d.scheduledFor}`}
                med={d.med}
                time={d.time}
                late={now - Date.parse(d.scheduledFor) > LATE_DOSE_MINUTES * 60_000}
                onGive={() => startGive({ med: d.med, scheduledFor: d.scheduledFor, time: d.time })}
                onNotGiven={() =>
                  setNotGiven({ med: d.med, scheduledFor: d.scheduledFor, time: d.time })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {g.asNeeded.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold">As needed</h3>
          <ul className="divide-y">
            {g.asNeeded.map((m) => (
              <DoseRow
                key={m.id}
                med={m}
                hint={prnWarning(prnStatus(m, g.logs), clockTime)}
                onGive={() => startGive({ med: m })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {showLogged ? (
        <section>
          <h3 className="text-sm font-semibold">Logged today</h3>
          <LoggedDoses
            clientId={clientId}
            logs={g.logged}
            meds={g.meds}
            onReported={() => void g.refresh()}
          />
        </section>
      ) : null}

      {give ? (
        <GiveDoseDialog
          target={give}
          logs={g.logs}
          ctx={ctx}
          onClose={() => setGive(null)}
          onSaved={saved}
        />
      ) : null}
      {notGiven ? (
        <NotGivenDialog
          target={notGiven}
          ctx={ctx}
          onClose={() => setNotGiven(null)}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
