// Import team members: paste or drop a CSV / Excel file, review every row
// (editable, removable, with each email's status here), then one save. Same
// writes per row as Add team member. Done → review everyone's Evidence packs.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  importTeamMembers,
  previewTeamImport,
  type TeamImportRowResult,
} from "@/lib/team-members/members.functions";
import {
  EMAIL_TAKEN_MESSAGE,
  IMPORT_MAX_ROWS,
  type EmailMatch,
} from "@/lib/team-members/add-member";
import {
  importPayloadRow,
  parseTeamImportFile,
  parseTeamImportText,
  validateTeamImportRows,
  type ParsedTeamImport,
  type TeamImportDraft,
} from "@/lib/team-members/import";
import type { ImportAgency } from "@/lib/team-members/import-columns";
import {
  downloadTeamImportTemplateCsv,
  downloadTeamImportTemplateXlsx,
} from "@/lib/team-members/import-template";
import {
  SpreadsheetDrop,
  TemplateButtons,
} from "@/components/spreadsheet-import/spreadsheet-entry";
import { rosterQueryKey, teamInvitesQueryKey } from "@/lib/team-members/roster";
import { normalizeSignupEmail } from "@/lib/signup-email";
import { useAgencyPresets } from "./preset-select";
import { ImportMemberRow } from "./import-member-row";
import { useTeamMemberFormOptions } from "./add-member-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      supervisors: optionsQ.data?.supervisors ?? [],
      viewerIsOwner: isOwner,
    }),
    [presets, optionsQ.data, isOwner],
  );
  const agencyReady = !!optionsQ.data && presets.length > 0;

  const [step, setStep] = useState<"entry" | "review" | "done">("entry");
  const [paste, setPaste] = useState("");
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

  const onFile = async (file: File) => {
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
                  position, access, home, supervisor, date of birth, worker type, transports clients
                  (yes/no).
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
              <TemplateButtons
                disabled={!agencyReady}
                onExcel={() => downloadTeamImportTemplateXlsx(agency)}
                onCsv={() => downloadTeamImportTemplateCsv(agency)}
              />
              <SpreadsheetDrop disabled={!agencyReady} onFile={(f) => void onFile(f)} />
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
              {rows.map((row) => (
                <ImportMemberRow
                  key={row.id}
                  row={row}
                  match={matchFor(row)}
                  issues={issues}
                  agency={agency}
                  onPatch={(patch) => patchRow(row.id, patch)}
                  onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                />
              ))}
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
