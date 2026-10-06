// Import team members: paste or drop a CSV / Excel file, review every row
// (editable, removable, with each email's status here), then one save. Same
// writes per row as Add team member. Done → review everyone's Evidence packs.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  importTeamMembers,
  previewTeamImport,
  type TeamImportRowResult,
} from "@/lib/team-members/members.functions";
import {
  EMAIL_MATCH_LABEL,
  EMAIL_TAKEN_MESSAGE,
  IMPORT_MAX_ROWS,
  type EmailMatch,
} from "@/lib/team-members/add-member";
import {
  downloadTeamImportTemplateCsv,
  downloadTeamImportTemplateXlsx,
  importPayloadRow,
  normalizeImportDate,
  parseTeamImportFile,
  parseTeamImportText,
  rowHasIssue,
  validateTeamImportRows,
  type ImportAgency,
  type ParsedTeamImport,
  type TeamImportDraft,
  type TeamImportIssueField,
} from "@/lib/team-members/import";
import { rosterQueryKey, teamInvitesQueryKey } from "@/lib/team-members/roster";
import { normalizeSignupEmail } from "@/lib/signup-email";
import { PresetSelect, useAgencyPresets } from "./preset-select";
import { useTeamMemberFormOptions } from "./add-member-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxMultiSelect } from "@/components/ui/checkbox-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NONE = "__none__";

type TextField =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "hire_date"
  | "date_of_birth"
  | "job_title";

const TEXT_FIELDS: Array<{
  field: TextField;
  label: string;
  issue?: TeamImportIssueField;
  type?: string;
}> = [
  { field: "first_name", label: "First name", issue: "name" },
  { field: "last_name", label: "Last name", issue: "name" },
  { field: "email", label: "Email", issue: "email" },
  { field: "phone", label: "Phone" },
  { field: "hire_date", label: "Hire date", issue: "hire_date" },
  { field: "date_of_birth", label: "Date of birth", issue: "date_of_birth" },
  { field: "job_title", label: "Job title" },
];

type DoneState = {
  results: TeamImportRowResult[];
  clientSkipped: Array<{ email: string; reason: string }>;
};

export function ImportTeamMembersDialog({
  open,
  onOpenChange,
  organizationId,
  onReviewEvidence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  onReviewEvidence: (userIds: string[]) => void;
}) {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewTeamImport);
  const importFn = useServerFn(importTeamMembers);
  const { presets, isOwner } = useAgencyPresets(organizationId);
  const optionsQ = useTeamMemberFormOptions(organizationId, open);
  const agency: ImportAgency = useMemo(
    () => ({
      presets,
      homes: optionsQ.data?.homes ?? [],
      positions: optionsQ.data?.positions ?? [],
      viewerIsOwner: isOwner,
    }),
    [presets, optionsQ.data, isOwner],
  );
  const agencyReady = !!optionsQ.data && presets.length > 0;

  const [step, setStep] = useState<"entry" | "review" | "done">("entry");
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<TeamImportDraft[]>([]);
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [sendInvites, setSendInvites] = useState(true);
  const [done, setDone] = useState<DoneState | null>(null);

  const emails = useMemo(
    () => [...new Set(rows.map((r) => normalizeSignupEmail(r.email)).filter(Boolean))].sort(),
    [rows],
  );
  const previewQ = useQuery({
    enabled: step === "review" && !!organizationId && emails.length > 0,
    queryKey: ["team-import-preview", organizationId, emails],
    queryFn: () =>
      previewFn({
        data: { organizationId: organizationId!, emails: emails.slice(0, IMPORT_MAX_ROWS) },
      }),
    staleTime: 30_000,
  });
  const matchByEmail = useMemo(
    () => new Map((previewQ.data ?? []).map((p) => [p.email, p.match] as const)),
    [previewQ.data],
  );
  const matchFor = (row: TeamImportDraft): EmailMatch =>
    matchByEmail.get(normalizeSignupEmail(row.email)) ?? "new";

  const toAdd = rows.filter((r) => matchFor(r) === "new");
  const issues = validateTeamImportRows(toAdd, agency);
  const blocked = issues.size > 0 || !toAdd.length || toAdd.length > IMPORT_MAX_ROWS;

  const reset = () => {
    setStep("entry");
    setPaste("");
    setRows([]);
    setIgnoredColumns([]);
    setSendInvites(true);
    setDone(null);
  };

  const showReview = (parsed: ParsedTeamImport) => {
    if (!parsed.rows.length) {
      toast.error("No people found. Use the template columns, or one person per line.");
      return;
    }
    setRows(parsed.rows);
    setIgnoredColumns(parsed.ignoredColumns);
    setStep("review");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      showReview(await parseTeamImportFile(file, agency));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const patchRow = (id: string, patch: Partial<TeamImportDraft>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveM = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization selected.");
      if (toAdd.length > IMPORT_MAX_ROWS) {
        throw new Error(`Import up to ${IMPORT_MAX_ROWS} people at a time.`);
      }
      const results = await importFn({
        data: { organizationId, rows: toAdd.map(importPayloadRow), sendInvites },
      });
      const clientSkipped = rows
        .filter((r) => matchFor(r) !== "new")
        .map((r) => ({
          email: normalizeSignupEmail(r.email),
          reason: skipReason(matchFor(r)),
        }));
      return { results, clientSkipped };
    },
    onSuccess: (state) => {
      setDone(state);
      setStep("done");
      void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
      void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const added = done?.results.filter((r) => r.status === "created") ?? [];
  const invitedCount = added.filter((r) => r.invited).length;
  const skipped = [
    ...(done?.results
      .filter((r) => r.status === "skipped")
      .map((r) => ({ email: r.email, reason: r.reason ?? "Skipped." })) ?? []),
    ...(done?.clientSkipped ?? []),
  ];
  const notInvited = added.filter((r) => !r.invited && r.reason);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={step === "review" ? "import-review" : "import-dialog"}
        className={
          step === "review"
            ? "max-w-4xl max-h-[90vh] overflow-y-auto"
            : "max-w-lg max-h-[90vh] overflow-y-auto"
        }
      >
        {step === "entry" && (
          <>
            <DialogHeader>
              <DialogTitle>Import team members</DialogTitle>
              <DialogDescription>
                Paste rows or drop a file. You&apos;ll review everyone before anything is saved.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="roster-paste">Paste rows</Label>
                <Textarea
                  id="roster-paste"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder="Jane Doe, jane.doe@example.com, 555-123-4567, 7/1/2026, DSP, Maple House"
                  className="min-h-28 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  A header row is fine. Without one, use this order: name, email, phone, hire date,
                  preset, home, job title, position, date of birth, transports (yes/no).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!paste.trim() || !agencyReady}
                onClick={() => showReview(parseTeamImportText(paste, agency))}
              >
                Review pasted rows
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!agencyReady}
                  onClick={() => {
                    void downloadTeamImportTemplateXlsx(agency).catch(() =>
                      toast.error("Could not build the Excel template."),
                    );
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download Excel template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!agencyReady}
                  onClick={() => downloadTeamImportTemplateCsv(agency)}
                >
                  <Download className="mr-2 h-4 w-4" /> Download CSV template
                </Button>
              </div>
              <label
                data-testid="import-drop-zone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!agencyReady) return;
                  void onFile(e.dataTransfer.files?.[0]);
                }}
                className={
                  "grid cursor-pointer gap-2 rounded-md border border-dashed p-6 text-center text-sm " +
                  (dragging ? "border-[var(--hive-primary)] bg-muted/50" : "border-border")
                }
              >
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <span>Drop a CSV or Excel file, or click to choose</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={!agencyReady}
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Review before adding</DialogTitle>
              <DialogDescription>
                Fix anything highlighted or remove the row. People who already have an account are
                skipped; nothing here changes an existing person.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground" data-testid="import-counts">
              {toAdd.length} to add
              {rows.length - toAdd.length > 0 && ` · ${rows.length - toAdd.length} skipped`}
              {toAdd.length > IMPORT_MAX_ROWS && ` · import up to ${IMPORT_MAX_ROWS} at a time`}
            </p>
            {ignoredColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ignored columns: {ignoredColumns.join(", ")}.
              </p>
            )}
            <div className="grid gap-3">
              {rows.map((row) => {
                const match = matchFor(row);
                const rowIssues = match === "new" ? (issues.get(row.id) ?? []) : [];
                const bad = (f?: TeamImportIssueField) =>
                  !!f && match === "new" && rowHasIssue(issues, row.id, f);
                return (
                  <div
                    key={row.id}
                    className="grid gap-2 rounded-md border border-border p-3"
                    data-testid="import-row"
                  >
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
                        onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
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
                            onChange={(e) => patchRow(row.id, { [field]: e.target.value })}
                            onBlur={
                              field === "hire_date" || field === "date_of_birth"
                                ? (e) =>
                                    patchRow(row.id, {
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
                            patchRow(row.id, {
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
                            patchRow(row.id, { homeId: home?.id ?? "", home: home?.name ?? "" });
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
                        <Label className="text-xs">Position</Label>
                        <CheckboxMultiSelect
                          value={row.positions}
                          onChange={(positions) =>
                            patchRow(row.id, {
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
                        <span className={bad("transports") ? "text-destructive" : ""}>
                          Transports clients
                        </span>
                        <Switch
                          checked={row.transports}
                          onCheckedChange={(v) =>
                            patchRow(row.id, { transports: v, transportsRaw: v ? "yes" : "no" })
                          }
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
              })}
            </div>
            <DialogFooter className="gap-3 sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep("entry")}>
                Back
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sendInvites}
                  onCheckedChange={(v) => setSendInvites(v === true)}
                />
                Email invites to everyone
              </label>
              <Button
                type="button"
                disabled={!organizationId || blocked || saveM.isPending || previewQ.isFetching}
                className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                onClick={() => saveM.mutate()}
              >
                {saveM.isPending
                  ? "Adding…"
                  : toAdd.length === 1
                    ? "Add 1 person"
                    : `Add ${toAdd.length} people`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && done && (
          <>
            <DialogHeader>
              <DialogTitle>Import finished</DialogTitle>
              <DialogDescription data-testid="import-done-summary">
                Added {added.length}. Invites sent to {invitedCount}.
              </DialogDescription>
            </DialogHeader>
            {skipped.length > 0 && (
              <div className="grid gap-1 text-sm">
                <p className="font-medium">Skipped</p>
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {skipped.map((s, i) => (
                    <li key={`${s.email}-${i}`}>
                      {s.email}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notInvited.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
                {notInvited.map((r) => (
                  <li key={r.email}>
                    {r.email}: {r.reason}
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
              >
                Done
              </Button>
              {added.length > 0 && (
                <Button
                  type="button"
                  className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                  onClick={() => {
                    const ids = added.map((r) => r.userId).filter((id): id is string => !!id);
                    onOpenChange(false);
                    reset();
                    onReviewEvidence(ids);
                  }}
                >
                  Review evidence packs for {added.length}{" "}
                  {added.length === 1 ? "person" : "people"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function skipReason(match: EmailMatch): string {
  if (match === "already_here") return "Already on the roster.";
  if (match === "inactive_here")
    return "Used to work here — reactivate them from the Inactive list.";
  return EMAIL_TAKEN_MESSAGE;
}

export function ImportTeamMembersButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled}>
      <FileSpreadsheet className="mr-2 h-4 w-4" /> Import team members
    </Button>
  );
}
