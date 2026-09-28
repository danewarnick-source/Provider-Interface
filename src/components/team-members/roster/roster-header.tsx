import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { useAgencySetup } from "@/hooks/use-agency-setup";
import { shouldBlockStaffClientCreate } from "@/lib/agency-setup-gate";
import { rosterCsv, rosterCsvFileName, type RosterRow } from "@/lib/team-members/roster";
import {
  AddEmployeeButton,
  AddEmployeeWizard,
} from "@/components/team-members/add/add-member-dialog";
import {
  EmployeeRosterUploadButton,
  EmployeeRosterUploadWizard,
} from "@/components/team-members/add/import-members-dialog";
import {
  FinishEmployeeSetupWizard,
  type NeedsSetupPerson,
} from "@/components/team-members/add/finish-setup-dialog";

function toNeedsSetup(r: RosterRow): NeedsSetupPerson {
  return {
    userId: r.userId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    hireDate: r.hireDate ?? "",
    accessLevel: r.accessLevel,
    accessPresetId: r.presetId,
    jobTitle: r.jobTitle ?? "",
    department: r.setup?.department ?? "",
    employeeId: r.employeeId,
    workerType: r.setup?.workerType ?? "",
  };
}

/** Client-side CSV of exactly the rows on screen. */
function downloadCsv(rows: RosterRow[]) {
  const blob = new Blob([rosterCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = rosterCsvFileName();
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Title, counts and the page buttons, plus the Add / Import / Finish setup
 * dialogs they open. Add and Import need Hire & deactivate: Edit. On phones the
 * title sits on its own row and the buttons go full width underneath.
 */
export function RosterHeader({
  organizationId,
  counts,
  needsSetupRows,
  exportRows,
  addFlag,
  importFlag,
}: {
  organizationId: string | null;
  counts: { active: number; inactive: number; invited: number };
  needsSetupRows: RosterRow[];
  exportRows: RosterRow[] | null;
  addFlag: boolean;
  importFlag: boolean;
}) {
  const { canCategory } = useAccess();
  const canHire = canCategory("staff_hiring", "edit");
  const { status: setupStatus } = useAgencySetup();
  const blocked = !organizationId || shouldBlockStaffClientCreate(setupStatus);
  const [addOpen, setAddOpen] = useState(addFlag);
  const [importOpen, setImportOpen] = useState(importFlag);
  const [finishOpen, setFinishOpen] = useState(false);
  useEffect(() => {
    if (addFlag) setAddOpen(true);
  }, [addFlag]);
  useEffect(() => {
    if (importFlag) setImportOpen(true);
  }, [importFlag]);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground" data-testid="roster-counts">
            {counts.active} active · {counts.inactive} inactive · {counts.invited} invited
          </p>
        </div>
        <div className="grid w-full gap-2 md:flex md:w-auto md:flex-wrap [&>button]:w-full md:[&>button]:w-auto">
          {canHire && <AddEmployeeButton onClick={() => setAddOpen(true)} disabled={blocked} />}
          {canHire && needsSetupRows.length > 0 && (
            <Button variant="outline" onClick={() => setFinishOpen(true)} disabled={blocked}>
              Finish setup ({needsSetupRows.length})
            </Button>
          )}
          {canHire && (
            <EmployeeRosterUploadButton onClick={() => setImportOpen(true)} disabled={blocked} />
          )}
          <Button
            variant="ghost"
            onClick={() => exportRows && downloadCsv(exportRows)}
            disabled={!exportRows?.length}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>
      {canHire && (
        <>
          <AddEmployeeWizard
            open={addOpen}
            onOpenChange={setAddOpen}
            organizationId={organizationId}
          />
          <EmployeeRosterUploadWizard
            open={importOpen}
            onOpenChange={setImportOpen}
            organizationId={organizationId}
          />
          <FinishEmployeeSetupWizard
            open={finishOpen}
            onOpenChange={setFinishOpen}
            organizationId={organizationId}
            people={needsSetupRows.map(toNeedsSetup)}
          />
        </>
      )}
    </>
  );
}
