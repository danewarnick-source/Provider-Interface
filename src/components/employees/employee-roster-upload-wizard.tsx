import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyEmployeeRosterRow } from "@/lib/employees.functions";
import {
  type EmployeeRosterDraft,
  type EmployeeRosterHeader,
  applyRosterName,
  classifyRosterRowAction,
  parseEmployeeRosterCsv,
  parseEmployeeRosterPaste,
  parseEmployeeRosterRecords,
  rosterRowHasFieldIssue,
  triggerEmployeeRosterTemplateDownload,
  validateEmployeeRosterRows,
} from "@/lib/employee-roster-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PREVIEW_FIELDS: EmployeeRosterHeader[] = ["name", "email", "phone", "hire_date", "job_title"];

async function parseRosterFile(
  file: File,
): Promise<{ rows: EmployeeRosterDraft[]; ignoredColumns: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    const first = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
    if (!/email/i.test(first)) return parseEmployeeRosterPaste(text);
    return parseEmployeeRosterCsv(text);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return { rows: [], ignoredColumns: [] };
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const headers = json.length ? Object.keys(json[0] ?? {}) : [];
  const records = json.map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = String(r[h] ?? "").trim();
    return out;
  });
  return parseEmployeeRosterRecords(records, headers);
}

function labelFor(field: EmployeeRosterHeader): string {
  switch (field) {
    case "name":
      return "Name";
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "hire_date":
      return "Hire date";
    case "job_title":
      return "Job title";
  }
}

export function EmployeeRosterUploadWizard({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
}) {
  const qc = useQueryClient();
  const applyRow = useServerFn(applyEmployeeRosterRow);

  const [step, setStep] = useState<"entry" | "preview" | "done">("entry");
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<EmployeeRosterDraft[]>([]);
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [addedCount, setAddedCount] = useState(0);

  const { data: existingEmails = [] } = useQuery({
    enabled: !!organizationId && open,
    queryKey: ["employee-roster-emails", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization selected.");
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);
      const ids = (members ?? []).map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (profs ?? [])
        .map((p) =>
          String(p.email ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean);
    },
  });

  const actions = useMemo(() => {
    const map = new Map<string, ReturnType<typeof classifyRosterRowAction>>();
    for (const row of rows) map.set(row.id, classifyRosterRowAction(row.email, existingEmails));
    return map;
  }, [rows, existingEmails]);

  const toCreate = rows.filter((row) => actions.get(row.id) === "create");
  const issues = validateEmployeeRosterRows(toCreate);
  const hasErrors = issues.size > 0;
  const skipCount = rows.length - toCreate.length;

  const resetAll = () => {
    setStep("entry");
    setPaste("");
    setRows([]);
    setIgnoredColumns([]);
    setAddedCount(0);
  };

  const patchRow = (id: string, patch: Partial<EmployeeRosterDraft>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (patch.name !== undefined) return applyRosterName(row, patch.name);
        return { ...row, ...patch };
      }),
    );
  };

  const showPreview = (parsed: { rows: EmployeeRosterDraft[]; ignoredColumns: string[] }) => {
    if (!parsed.rows.length) {
      toast.error("No people found. Use a name, email, phone, hire date, and job title.");
      return;
    }
    setRows(parsed.rows);
    setIgnoredColumns(parsed.ignoredColumns);
    setStep("preview");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization selected.");
      if (hasErrors) throw new Error("Fix the highlighted rows before adding anyone.");
      if (!toCreate.length) throw new Error("Everyone in this list is already on the roster.");
      let added = 0;
      const skipped: string[] = [];
      const errors: string[] = [];
      for (const row of toCreate) {
        try {
          const res = await applyRow({
            data: {
              organizationId,
              firstName: row.first_name.trim(),
              lastName: row.last_name.trim(),
              email: row.email.trim(),
              phone: row.phone.trim(),
              hireDate: row.hire_date,
              jobTitle: row.job_title.trim(),
            },
          });
          if (res.action === "skipped") {
            skipped.push(`${row.email}: ${res.reason ?? "Skipped."}`);
            continue;
          }
          added += 1;
        } catch (e) {
          const who = row.name.trim() || row.email;
          errors.push(`${who}: ${e instanceof Error ? e.message : "Could not add."}`);
        }
      }
      if (!added) throw new Error(errors.join(" ") || skipped.join(" ") || "No one was added.");
      return { added, skipped, errors };
    },
    onSuccess: ({ added, skipped, errors }) => {
      const extra = [...skipped, ...errors];
      if (extra.length) toast.warning(`Added ${added}. ${extra.join(" ")}`);
      else toast.success(added === 1 ? "Added 1 person" : `Added ${added} people`);
      setAddedCount(added);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["employee-roster-emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      showPreview(await parseRosterFile(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAll();
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={step === "preview" ? "add-several-preview" : "add-several-dialog"}
        className={
          step === "preview"
            ? "max-w-3xl max-h-[90vh] overflow-y-auto"
            : "max-w-lg max-h-[90vh] overflow-y-auto"
        }
      >
        {step === "entry" && (
          <>
            <DialogHeader>
              <DialogTitle>Add several at once</DialogTitle>
              <DialogDescription>
                Add basic info for several team members now. Each person lands on the roster as
                Needs setup, and you&apos;ll answer their job questions next.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="roster-paste">Paste rows</Label>
                <Textarea
                  id="roster-paste"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder={
                    "Jane Doe, jane.doe@example.com, 555-123-4567, 2026-07-01, Direct Support"
                  }
                  className="min-h-28 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  One person per line: name, email, phone, hire date, job title. A header row is
                  fine. No invites are sent.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!paste.trim()}
                onClick={() => showPreview(parseEmployeeRosterPaste(paste))}
              >
                Review pasted rows
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => triggerEmployeeRosterTemplateDownload()}
              >
                <Download className="mr-2 h-4 w-4" /> Download template
              </Button>
              <label className="grid cursor-pointer gap-2 rounded-md border border-dashed border-border p-6 text-center text-sm">
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <span>Drop a CSV or Excel file, or click to choose</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void onFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <DialogHeader>
              <DialogTitle>Review before adding</DialogTitle>
              <DialogDescription>
                Fix anything highlighted. People already on the roster are skipped. No invites are
                sent, and nothing here updates an existing person.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              {toCreate.length} to add
              {skipCount > 0 && ` · ${skipCount} already on the roster`}
            </p>
            {ignoredColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ignored columns: {ignoredColumns.join(", ")}.
              </p>
            )}
            <div className="grid gap-3">
              {rows.map((row) => {
                const action = actions.get(row.id) ?? "create";
                const rowIssues = action === "create" ? (issues.get(row.id) ?? []) : [];
                return (
                  <div key={row.id} className="grid gap-2 rounded-md border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {action === "skip"
                        ? "Already on the roster — skipped"
                        : rowIssues.length
                          ? "Needs a fix"
                          : "Will add as Needs setup"}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PREVIEW_FIELDS.map((field) => (
                        <div key={field} className="grid gap-1">
                          <Label className="text-xs">{labelFor(field)}</Label>
                          <Input
                            value={row[field]}
                            onChange={(e) => patchRow(row.id, { [field]: e.target.value })}
                            className={
                              "h-8 text-sm " +
                              (rosterRowHasFieldIssue(issues, row.id, field) && action === "create"
                                ? "border-destructive"
                                : "")
                            }
                          />
                        </div>
                      ))}
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
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep("entry")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={
                  !organizationId || !toCreate.length || hasErrors || createMutation.isPending
                }
                className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending
                  ? "Adding…"
                  : toCreate.length === 1
                    ? "Add 1 person"
                    : `Add ${toCreate.length} people`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Added to the roster</DialogTitle>
              <DialogDescription>
                {addedCount === 1
                  ? "1 person is on the roster as Needs setup."
                  : `${addedCount} people are on the roster as Needs setup.`}{" "}
                Finish setup from the roster to answer their job questions. No invites were sent.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                onClick={() => {
                  onOpenChange(false);
                  resetAll();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeRosterUploadButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled}>
      <FileSpreadsheet className="mr-2 h-4 w-4" /> Add several at once
    </Button>
  );
}
