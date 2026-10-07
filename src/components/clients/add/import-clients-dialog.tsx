// Import several clients from a spreadsheet (no AI): download the template,
// upload it, review every row (editable, removable, problems on each cell,
// duplicate Medicaid IDs flagged), then one save through addClient.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SpreadsheetDrop,
  TemplateButtons,
} from "@/components/spreadsheet-import/spreadsheet-entry";
import { gridFromFile } from "@/lib/spreadsheet-import/files";
import { IMPORT_MAX_ROWS } from "@/lib/team-members/add-member";
import {
  parseClientImportGrid,
  validateClientImportRows,
  type ClientImportDraft,
} from "@/lib/clients/import-sheet";
import {
  downloadClientTemplateCsv,
  downloadClientTemplateXlsx,
} from "@/lib/clients/import-sheet-template";
import { ImportClientRow } from "./import-client-row";
import { useExistingMedicaid, useImportClients, type ImportOutcome } from "./use-import-clients";

export function ImportClientsDialog({
  organizationId,
  open,
  homes,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  homes: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const agency = useMemo(() => ({ homes }), [homes]);
  const [step, setStep] = useState<"entry" | "review" | "done">("entry");
  const [rows, setRows] = useState<ClientImportDraft[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const existingQ = useExistingMedicaid(organizationId, rows, step === "review");
  const save = useImportClients(organizationId, agency);
  const issues = validateClientImportRows(rows, agency, existingQ.data ?? []);
  const tooMany = rows.length > IMPORT_MAX_ROWS;
  const blocked = !rows.length || issues.size > 0 || tooMany || existingQ.isFetching;

  const reset = () => {
    setStep("entry");
    setRows([]);
    setIgnored([]);
    setOutcomes([]);
  };
  const close = (next: boolean) => {
    if (!next && save.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  async function onFile(file: File) {
    try {
      const parsed = parseClientImportGrid(await gridFromFile(file));
      if (!parsed.headerFound) {
        toast.error(
          "Couldn't find the header row. Put the template's column names (First name, Last name, Medicaid ID…) in one row.",
        );
        return;
      }
      if (!parsed.rows.length) {
        toast.error("No clients found under the header row.");
        return;
      }
      setRows(parsed.rows);
      setIgnored(parsed.ignoredColumns);
      setStep("review");
    } catch {
      toast.error("Couldn't read that file. Save it as .xlsx or .csv and try again.");
    }
  }

  const added = outcomes.flatMap((o) => (o.status === "created" ? [o] : []));
  const skipped = outcomes.flatMap((o) => (o.status === "skipped" ? [o] : []));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto ${step === "review" ? "max-w-5xl" : "max-w-lg"}`}
      >
        {step === "entry" && (
          <>
            <DialogHeader>
              <DialogTitle>Import clients from a spreadsheet</DialogTitle>
              <DialogDescription>
                Download the template, fill in one client per row, then upload it. You&apos;ll
                review every row before anything is saved.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <TemplateButtons
                onExcel={() => downloadClientTemplateXlsx(agency)}
                onCsv={() => downloadClientTemplateCsv(agency)}
              />
              <SpreadsheetDrop onFile={(f) => void onFile(f)} />
              <p className="text-xs text-muted-foreground">
                Code dates and units come later, from the PCSP or by hand on each profile.
              </p>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Review before adding</DialogTitle>
              <DialogDescription>
                Fix anything highlighted or remove the row. Nothing is saved until you add them.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground" data-testid="import-client-counts">
              {rows.length} client{rows.length === 1 ? "" : "s"}
              {issues.size > 0 && ` · ${issues.size} with problems to fix`}
              {tooMany && ` · import up to ${IMPORT_MAX_ROWS} at a time`}
              {ignored.length > 0 && ` · ignored columns: ${ignored.join(", ")}`}
            </p>
            <div className="grid gap-3">
              {rows.map((row) => (
                <ImportClientRow
                  key={row.id}
                  row={row}
                  issues={issues.get(row.id) ?? []}
                  agency={agency}
                  onPatch={(patch) =>
                    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)))
                  }
                  onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                />
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" disabled={save.isPending} onClick={() => setStep("entry")}>
                Back
              </Button>
              <Button
                disabled={blocked || save.isPending}
                data-testid="import-clients-save"
                onClick={() =>
                  save.mutate(rows, {
                    onSuccess: (out) => {
                      setOutcomes(out);
                      setStep("done");
                    },
                  })
                }
              >
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {save.isPending
                  ? `Adding ${save.done + 1} of ${rows.length}…`
                  : `Add ${rows.length} client${rows.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Import finished</DialogTitle>
              <DialogDescription data-testid="import-clients-summary">
                Added {added.length} client{added.length === 1 ? "" : "s"}
                {skipped.length > 0 && `, skipped ${skipped.length}`}.
                {added.length > 0 &&
                  " Each one opens with “Finish setting up” for their photo, health, team and client file."}
              </DialogDescription>
            </DialogHeader>
            {added.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {added.map((o) => (
                  <li key={o.id}>
                    <Link
                      to="/dashboard/clients/$clientId"
                      params={{ clientId: o.id }}
                      search={{}}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => close(false)}
                    >
                      Open {o.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {skipped.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-destructive">
                {skipped.map((o, i) => (
                  <li key={`${o.name}-${i}`}>
                    {o.name || "Unnamed row"}: {o.reason}
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
