// One row of the Import team members review: every column editable, the
// row removable, problems shown on the cell and listed under the row.

import type { EmailMatch, WorkerType } from "@/lib/team-members/add-member";
import { EMAIL_MATCH_LABEL, WORKER_TYPES, WORKER_TYPE_LABEL } from "@/lib/team-members/add-member";
import {
  rowHasIssue,
  type TeamImportDraft,
  type TeamImportIssue,
  type TeamImportIssueField,
} from "@/lib/team-members/import";
import type { ImportAgency } from "@/lib/team-members/import-columns";
import { normalizeImportDate } from "@/lib/spreadsheet-import/cells";
import { Trash2 } from "lucide-react";
import { PresetSelect } from "./preset-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CheckboxMultiSelect } from "@/components/ui/checkbox-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

type TextField = "first_name" | "last_name" | "email" | "phone" | "hire_date" | "date_of_birth";

const TEXT_FIELDS: Array<{ field: TextField; label: string; issue?: TeamImportIssueField }> = [
  { field: "first_name", label: "First name", issue: "name" },
  { field: "last_name", label: "Last name", issue: "name" },
  { field: "email", label: "Email", issue: "email" },
  { field: "phone", label: "Phone" },
  { field: "hire_date", label: "Hire date", issue: "hire_date" },
  { field: "date_of_birth", label: "Date of birth", issue: "date_of_birth" },
];

export function ImportMemberRow({
  row,
  match,
  issues,
  agency,
  onPatch,
  onRemove,
}: {
  row: TeamImportDraft;
  match: EmailMatch;
  issues: Map<string, TeamImportIssue[]>;
  agency: ImportAgency;
  onPatch: (patch: Partial<TeamImportDraft>) => void;
  onRemove: () => void;
}) {
  const presets = agency.presets;
  const isOwner = agency.viewerIsOwner;
  const rowIssues = match === "new" ? (issues.get(row.id) ?? []) : [];
  const bad = (f?: TeamImportIssueField) =>
    !!f && match === "new" && rowHasIssue(issues, row.id, f);
  return (
    <div className="grid gap-2 rounded-md border border-border p-3" data-testid="import-row">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={match === "new" ? "outline" : "secondary"}>
          {EMAIL_MATCH_LABEL[match]}
          {match !== "new" && " — skipped"}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onRemove()}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove row
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {TEXT_FIELDS.map(({ field, label, issue }) => (
          <div key={field} className="grid gap-1">
            <Label className="text-xs" htmlFor={`${field}-${row.id}`}>
              {label}
            </Label>
            <Input
              id={`${field}-${row.id}`}
              value={row[field]}
              onChange={(e) => onPatch({ [field]: e.target.value })}
              onBlur={
                field === "hire_date" || field === "date_of_birth"
                  ? (e) =>
                      onPatch({
                        [field]: normalizeImportDate(e.target.value),
                      })
                  : undefined
              }
              className={"h-8 text-sm " + (bad(issue) ? "border-destructive" : "")}
            />
          </div>
        ))}
        <div className="grid gap-1">
          <Label className="text-xs" htmlFor={`preset-${row.id}`}>
            Access
          </Label>
          <PresetSelect
            id={`preset-${row.id}`}
            value={row.access}
            onChange={(access) =>
              onPatch({
                access,
                preset: presets.find((p) => p.id === access)?.name ?? "",
              })
            }
            presets={presets}
            isOwner={isOwner}
            includeOwner={false}
            invalid={bad("preset")}
            className="h-8 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs" htmlFor={`home-${row.id}`}>
            Home
          </Label>
          <Select
            value={row.homeId || NONE}
            onValueChange={(v) => {
              const home = agency.homes.find((h) => h.id === v);
              onPatch({ homeId: home?.id ?? "", home: home?.name ?? "" });
            }}
          >
            <SelectTrigger
              id={`home-${row.id}`}
              className={"h-8 text-sm " + (bad("home") ? "border-destructive" : "")}
            >
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {agency.homes.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs" htmlFor={`supervisor-${row.id}`}>
            Supervisor
          </Label>
          <Select
            value={row.supervisorId || NONE}
            onValueChange={(v) => {
              const sup = agency.supervisors.find((x) => x.memberId === v);
              onPatch({
                supervisorId: sup?.memberId ?? "",
                supervisor: sup?.name ?? "",
              });
            }}
          >
            <SelectTrigger
              id={`supervisor-${row.id}`}
              className={"h-8 text-sm " + (bad("supervisor") ? "border-destructive" : "")}
            >
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {agency.supervisors.map((x) => (
                <SelectItem key={x.memberId} value={x.memberId}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs" htmlFor={`worker-${row.id}`}>
            Worker type
          </Label>
          <Select
            value={row.workerType}
            onValueChange={(v) => onPatch({ workerType: v as WorkerType })}
          >
            <SelectTrigger id={`worker-${row.id}`} className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKER_TYPES.map((w) => (
                <SelectItem key={w} value={w}>
                  {WORKER_TYPE_LABEL[w]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Position</Label>
          <CheckboxMultiSelect
            value={row.positions}
            onChange={(positions) =>
              onPatch({
                positions,
                position: positions
                  .map((k) => agency.positions.find((p) => p.key === k)?.label ?? k)
                  .join("; "),
              })
            }
            options={agency.positions.map((p) => ({ value: p.key, label: p.label }))}
            placeholder="None"
            maxChips={2}
          />
        </div>
        <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
          <span className={bad("transports") ? "text-destructive" : ""}>Transports clients</span>
          <Switch
            checked={row.transports}
            onCheckedChange={(v) => onPatch({ transports: v, transportsRaw: v ? "yes" : "no" })}
            aria-label="Transports clients"
          />
        </label>
      </div>
      {rowIssues.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-destructive">
          {rowIssues.map((issue) => (
            <li key={`${row.id}-${issue.field}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
