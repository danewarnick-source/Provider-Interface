// Discharge step 1: date, reason, who started it, and the notice date. An
// agency-started discharge with under 30 days' notice shows a warning.

import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INITIATED_BY, noticeWarning, type InitiatedBy } from "@/lib/clients/discharge";

export type DischargeDetails = {
  dischargeDate: string;
  reason: string;
  initiatedBy: InitiatedBy | "";
  noticeDate: string;
};

export function DetailsStep({
  value,
  onChange,
}: {
  value: DischargeDetails;
  onChange: (next: DischargeDetails) => void;
}) {
  const set = <K extends keyof DischargeDetails>(k: K, v: DischargeDetails[K]) =>
    onChange({ ...value, [k]: v });
  const warning = noticeWarning(value);
  return (
    <div className="space-y-3" data-testid="discharge-details-step">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="discharge-date">Discharge date</Label>
          <Input
            id="discharge-date"
            type="date"
            value={value.dischargeDate}
            onChange={(e) => set("dischargeDate", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="discharge-initiated">Who started it</Label>
          <Select
            value={value.initiatedBy}
            onValueChange={(v) => set("initiatedBy", v as InitiatedBy)}
          >
            <SelectTrigger id="discharge-initiated" data-testid="discharge-initiated-by">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INITIATED_BY) as InitiatedBy[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {INITIATED_BY[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="discharge-reason">Reason</Label>
        <Textarea
          id="discharge-reason"
          rows={3}
          value={value.reason}
          onChange={(e) => set("reason", e.target.value)}
          data-testid="discharge-reason"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="discharge-notice">Notice given on</Label>
        <Input
          id="discharge-notice"
          type="date"
          value={value.noticeDate}
          onChange={(e) => set("noticeDate", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The day the client, guardian or DSPD was told. Leave blank if there wasn't notice.
        </p>
      </div>
      {warning ? (
        <p
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          data-testid="discharge-notice-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {warning}
        </p>
      ) : null}
    </div>
  );
}
