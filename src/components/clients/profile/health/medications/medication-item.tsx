// One medication on the Medications tab: name and strength, when it's
// given, what it's for, what to watch for, badges, reminders, and (for
// editors) the menu: Edit, Pause or Resume, Stop, Send with client, History.

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import type { CardTone } from "@/components/clients/profile/cards/section-card";
import {
  medStatus,
  medicationBadges,
  nameWithStrength,
  statusReason,
  whenGivenLabel,
  type MedBadge,
} from "@/lib/medications/med-display";
import { psychotropicWarnings, type MedicationFields } from "@/lib/medications/med-rules";
import type { ClientMedication } from "./use-medications";

export type MedAction = "edit" | "pause" | "resume" | "stop" | "send" | "history";

const TONE: Record<MedBadge["tone"], CardTone> = {
  info: "info",
  warn: "profile",
  danger: "danger",
};

export function MedicationItem({
  med,
  canEdit,
  onAction,
}: {
  med: ClientMedication;
  canEdit: boolean;
  onAction: (action: MedAction, med: ClientMedication) => void;
}) {
  const status = medStatus(med);
  const reminders =
    status === "active" ? psychotropicWarnings(med as unknown as MedicationFields) : [];
  const reason = statusReason(med);
  return (
    <div className="flex gap-3 rounded-xl border border-hive-border p-4" data-testid="med-item">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-hive-ink">{nameWithStrength(med)}</p>
        <p className="text-sm">{whenGivenLabel(med)}</p>
        {med.purpose ? (
          <p className="truncate text-sm text-muted-foreground">For: {med.purpose}</p>
        ) : null}
        {med.side_effects ? (
          <p className="truncate text-sm text-muted-foreground">Watch for: {med.side_effects}</p>
        ) : null}
        {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {medicationBadges(med).map((b) => (
            <StatusTag key={b.key} tone={TONE[b.tone]}>
              {b.label}
            </StatusTag>
          ))}
          {reminders.map((r) => (
            <span
              key={r.field}
              className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
            >
              {r.message}
            </span>
          ))}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${med.medication_name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && status !== "stopped" ? (
            <>
              <DropdownMenuItem onSelect={() => onAction("edit", med)}>Edit</DropdownMenuItem>
              {status === "paused" ? (
                <DropdownMenuItem onSelect={() => onAction("resume", med)}>Resume</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => onAction("pause", med)}>Pause</DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => onAction("stop", med)}>Stop</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction("send", med)}>
                Send with client
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onSelect={() => onAction("history", med)}>History</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
