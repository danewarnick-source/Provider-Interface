// One row of the client spreadsheet review: every cell editable, the row
// removable, each problem shown on its cell and listed under the row.

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeImportDate } from "@/lib/spreadsheet-import/cells";
import {
  CLIENT_IMPORT_COLUMNS,
  ownGuardianValue,
  resolveHome,
  type ClientImportAgency,
  type ClientImportColumn,
  type ClientImportDraft,
  type ClientImportIssue,
} from "@/lib/clients/import-sheet";

const NONE = "__none__";
const LABEL = Object.fromEntries(CLIENT_IMPORT_COLUMNS.map((c) => [c.key, c.label])) as Record<
  ClientImportColumn,
  string
>;

const GROUPS: Array<{ title: string; keys: ClientImportColumn[]; guardianOnly?: boolean }> = [
  {
    title: "Client",
    keys: [
      "first_name",
      "last_name",
      "date_of_birth",
      "medicaid_id",
      "client_pid",
      "phone",
      "address",
      "start_date",
    ],
  },
  {
    title: "Guardian",
    keys: ["guardian_name", "guardian_relationship", "guardian_phone", "guardian_email"],
    guardianOnly: true,
  },
  { title: "Support coordinator", keys: ["sc_name", "sc_phone", "sc_email", "sc_agency"] },
];

const DATES = new Set<ClientImportColumn>(["date_of_birth", "start_date"]);

export function ImportClientRow({
  row,
  issues,
  agency,
  onPatch,
  onRemove,
}: {
  row: ClientImportDraft;
  issues: ClientImportIssue[];
  agency: ClientImportAgency;
  onPatch: (patch: Partial<ClientImportDraft>) => void;
  onRemove: () => void;
}) {
  const bad = (key: ClientImportColumn) => issues.some((i) => i.field === key);
  const errorCls = (key: ClientImportColumn) => (bad(key) ? "border-destructive" : "");
  const own = ownGuardianValue(row);
  const name = `${row.first_name} ${row.last_name}`.trim() || "New client";

  const cell = (key: ClientImportColumn) => (
    <div key={key} className="grid gap-1">
      <Label className="text-xs" htmlFor={`${key}-${row.id}`}>
        {LABEL[key]}
      </Label>
      <Input
        id={`${key}-${row.id}`}
        value={row[key]}
        aria-invalid={bad(key)}
        onChange={(e) => onPatch({ [key]: e.target.value })}
        onBlur={
          DATES.has(key)
            ? (e) => onPatch({ [key]: normalizeImportDate(e.target.value) })
            : undefined
        }
        className={`h-9 text-sm ${errorCls(key)}`}
      />
    </div>
  );

  return (
    <div className="grid gap-3 rounded-md border border-border p-3" data-testid="import-client-row">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{name}</p>
        <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={onRemove}>
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove row
        </Button>
      </div>
      {GROUPS.map((g) =>
        g.guardianOnly && own !== false ? null : (
          <fieldset key={g.title} className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </legend>
            <div className="grid gap-2 sm:grid-cols-4">{g.keys.map(cell)}</div>
          </fieldset>
        ),
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="grid gap-1">
          <Label className="text-xs" htmlFor={`home-${row.id}`}>
            Home
          </Label>
          <Select
            value={resolveHome(row.home, agency) ?? NONE}
            onValueChange={(v) =>
              onPatch({ home: agency.homes.find((h) => h.id === v)?.name ?? "" })
            }
          >
            <SelectTrigger id={`home-${row.id}`} className={`h-9 text-sm ${errorCls("home")}`}>
              <SelectValue placeholder="No home" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No home</SelectItem>
              {agency.homes.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs" htmlFor={`own-${row.id}`}>
            Own guardian
          </Label>
          <Select
            value={own === null ? "" : own ? "Y" : "N"}
            onValueChange={(v) => onPatch({ own_guardian: v })}
          >
            <SelectTrigger
              id={`own-${row.id}`}
              className={`h-9 text-sm ${errorCls("own_guardian")}`}
            >
              <SelectValue placeholder="Y or N" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Y">Yes</SelectItem>
              <SelectItem value="N">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <Label className="text-xs" htmlFor={`codes-${row.id}`}>
            Service codes (separated by ;)
          </Label>
          <Input
            id={`codes-${row.id}`}
            value={row.codes}
            aria-invalid={bad("codes")}
            onChange={(e) => onPatch({ codes: e.target.value })}
            className={`h-9 font-mono text-sm ${errorCls("codes")}`}
            placeholder="SLH; DSI"
          />
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-destructive">
          {issues.map((i) => (
            <li key={`${i.field}-${i.message}`}>
              {LABEL[i.field]}: {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
