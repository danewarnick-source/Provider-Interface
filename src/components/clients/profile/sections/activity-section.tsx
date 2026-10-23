// Activity & notes: one timeline of shifts, daily logs and incidents (needs
// Incidents: View), newest first, with filter pills. Each entry opens its
// full record in a side panel.

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { ActivityEntryRow } from "@/components/clients/profile/activity/activity-entry";
import {
  ActivityRecordPanel,
  recordFor,
  type OpenRecord,
} from "@/components/clients/profile/activity/activity-record-panel";
import { useClientActivity } from "@/components/clients/profile/activity/use-client-activity";
import {
  activityFilters,
  buildTimeline,
  filterTimeline,
  type ActivityEntry,
  type ActivityFilter,
} from "@/lib/clients/activity";

const PAGE = 40;

export function ActivitySection({ clientId, orgId }: { clientId: string; orgId: string }) {
  const { canCategory } = useAccess();
  const viewer = { canSeeIncidents: canCategory("incidents") };
  const a = useClientActivity(orgId, clientId, viewer);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<OpenRecord | null>(null);
  const timeline = buildTimeline(
    { shifts: a.shifts, logs: a.logs, incidents: a.incidents },
    viewer,
  );
  const entries = filterTimeline(timeline, filter);
  const names = useProfileNames(
    timeline.map((e) => e.authorId).filter((x): x is string => !!x),
  ).data;
  const author = (e: ActivityEntry) =>
    e.authorId ? (names?.get(e.authorId) ?? "Team member") : null;

  const openEntry = (e: ActivityEntry) =>
    setOpen(recordFor(e, { shifts: a.shifts, logs: a.logs, incidents: a.incidents }));

  return (
    <div className="flex flex-col gap-5" data-testid="client-section-activity">
      <SectionCard
        icon={History}
        tone="neutral"
        title="Activity & notes"
        description="Shifts, daily logs and incidents, newest first."
        testId="client-activity-timeline"
      >
        <div
          className="mb-3 flex gap-1 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter activity"
        >
          {activityFilters(viewer).map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "secondary" : "ghost"}
              aria-pressed={filter === f.value}
              className="shrink-0 rounded-full max-md:min-h-11"
              onClick={() => {
                setFilter(f.value);
                setShown(PAGE);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {a.loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : a.failed ? (
          <p className="text-sm text-destructive">Couldn't load activity. Please try again.</p>
        ) : entries.length === 0 ? (
          <EmptyState>
            Nothing here yet. Shift notes and daily logs show up once team members write them.
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-hive-border">
              {entries.slice(0, shown).map((e) => (
                <ActivityEntryRow
                  key={e.key}
                  entry={e}
                  author={author(e)}
                  onOpen={() => openEntry(e)}
                />
              ))}
            </ul>
            {entries.length > shown ? (
              <Button variant="outline" className="mt-3" onClick={() => setShown(shown + PAGE)}>
                Show {Math.min(PAGE, entries.length - shown)} more
              </Button>
            ) : null}
          </>
        )}
      </SectionCard>
      <ActivityRecordPanel
        record={open}
        author={open ? (author(open.entry) ?? "—") : "—"}
        clientId={clientId}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
