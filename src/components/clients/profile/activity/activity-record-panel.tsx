// The full record behind one timeline entry, in a side panel: labelled facts
// and the full text. Office notes show the lock and can be archived (never
// deleted); incidents link to the report in the Incidents queue.

import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { formatDate } from "@/lib/clients/dates";
import { shiftHours } from "@/lib/clients/notes";
import { ACTIVITY_KIND_LABELS, type ActivityEntry } from "@/lib/clients/activity";
import type { IncidentRow, LogRow, NoteRow, ShiftRow } from "./use-client-activity";

type Fact = { label: string; value: ReactNode };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US") : "—");

export type OpenRecord =
  | { entry: ActivityEntry; kind: "shift"; row: ShiftRow }
  | { entry: ActivityEntry; kind: "daily_log"; row: LogRow }
  | { entry: ActivityEntry; kind: "incident"; row: IncidentRow }
  | { entry: ActivityEntry; kind: "office_note"; row: NoteRow };

/** The full row behind a timeline entry, or null if it's gone. */
export function recordFor(
  e: ActivityEntry,
  rows: { shifts: ShiftRow[]; logs: LogRow[]; incidents: IncidentRow[]; notes: NoteRow[] },
): OpenRecord | null {
  const pick = <T extends { id: string }>(list: T[]) => list.find((r) => r.id === e.id);
  switch (e.kind) {
    case "shift": {
      const row = pick(rows.shifts);
      return row ? { entry: e, kind: "shift", row } : null;
    }
    case "daily_log": {
      const row = pick(rows.logs);
      return row ? { entry: e, kind: "daily_log", row } : null;
    }
    case "incident": {
      const row = pick(rows.incidents);
      return row ? { entry: e, kind: "incident", row } : null;
    }
    case "office_note": {
      const row = pick(rows.notes);
      return row ? { entry: e, kind: "office_note", row } : null;
    }
  }
}

function details(r: OpenRecord, author: string): { facts: Fact[]; body: string | null } {
  switch (r.kind) {
    case "shift":
      return {
        facts: [
          { label: "Team member", value: author },
          { label: "Code", value: r.row.service_type_code },
          { label: "Clock in", value: when(r.row.clock_in_timestamp) },
          { label: "Clock out", value: when(r.row.clock_out_timestamp) },
          {
            label: "Hours",
            value: shiftHours(r.row.clock_in_timestamp, r.row.clock_out_timestamp) ?? "Open",
          },
          { label: "Units billed", value: r.row.billed_units ?? "—" },
          { label: "Status", value: r.row.status },
          { label: "Review", value: r.row.review_status ?? "—" },
        ],
        body: r.row.shift_note_text,
      };
    case "daily_log":
      return {
        facts: [
          { label: "Written by", value: author },
          { label: "Status", value: r.row.status },
          { label: "Submitted", value: when(r.row.submitted_at) },
          { label: "Late", value: r.row.submitted_late ? "Yes" : "No" },
          ...(r.row.denial_reason ? [{ label: "Sent back because", value: r.row.denial_reason }] : []),
        ],
        body: r.row.narrative,
      };
    case "incident":
      return {
        facts: [
          { label: "Reported by", value: author },
          { label: "Report #", value: r.row.report_number ?? "—" },
          { label: "Types", value: (r.row.incident_types ?? []).join(", ") || "—" },
          { label: "Status", value: r.row.status },
          {
            label: "Flags",
            value:
              [r.row.is_abuse_neglect && "Abuse / neglect", r.row.is_fatality && "Fatality"]
                .filter(Boolean)
                .join(", ") || "—",
          },
        ],
        body: r.row.description,
      };
    case "office_note":
      return { facts: [{ label: "Written by", value: author }], body: r.row.body };
  }
}

export function ActivityRecordPanel({
  record,
  author,
  clientId,
  archiving,
  onArchive,
  onClose,
}: {
  record: OpenRecord | null;
  author: string;
  clientId: string;
  archiving: boolean;
  onArchive: (noteId: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const d = record ? details(record, author) : null;
  return (
    <Sheet open={!!record} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="activity-record">
        {record && d ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {ACTIVITY_KIND_LABELS[record.kind]} · {formatDate(record.entry.at)}
                {record.entry.officeOnly ? (
                  <StatusTag tone="neutral">
                    <Lock className="h-3 w-3" aria-hidden /> Office only
                  </StatusTag>
                ) : null}
              </SheetTitle>
              <SheetDescription>
                {record.entry.officeOnly
                  ? "Only people who can edit clients see office notes."
                  : "The full record."}
              </SheetDescription>
            </SheetHeader>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {d.facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="break-words font-medium text-hive-ink">{f.value ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 whitespace-pre-wrap rounded-xl border border-hive-border bg-[var(--hive-muted-surface)]/50 p-3 text-sm">
              {d.body?.trim() || "—"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 max-md:[&_button]:min-h-11">
              {record.kind === "incident" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/hub/documentation",
                      search: { tab: "incidents", client: clientId },
                    })
                  }
                >
                  Open in Incidents
                </Button>
              ) : null}
              {record.kind === "office_note" ? (
                <Button
                  variant="outline"
                  disabled={archiving}
                  onClick={() => onArchive(record.row.id)}
                >
                  Archive note
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
