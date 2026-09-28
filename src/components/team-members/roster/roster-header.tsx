import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { useAgencySetup } from "@/hooks/use-agency-setup";
import { shouldBlockStaffClientCreate } from "@/lib/agency-setup-gate";
import { rosterCsv, rosterCsvFileName, type RosterRow } from "@/lib/team-members/roster";
import {
  AddTeamMemberButton,
  AddTeamMemberDialog,
} from "@/components/team-members/add/add-member-dialog";
import {
  ImportTeamMembersButton,
  ImportTeamMembersDialog,
} from "@/components/team-members/add/import-members-dialog";
import { ReviewEvidencePackDialog } from "@/components/team-members/add/review-evidence-dialog";

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
 * Title, counts and the page buttons, plus the Add / Import dialogs they open
 * and the Evidence questionnaire those hand off to. Add and Import need Hire & deactivate: Edit. On phones the
 * title sits on its own row and the buttons go full width underneath.
 */
export function RosterHeader({
  organizationId,
  counts,
  exportRows,
  addFlag,
  importFlag,
}: {
  organizationId: string | null;
  counts: { active: number; inactive: number; invited: number };
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
  const [reviewIds, setReviewIds] = useState<string[]>([]);
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
          {canHire && <AddTeamMemberButton onClick={() => setAddOpen(true)} disabled={blocked} />}
          {canHire && (
            <ImportTeamMembersButton onClick={() => setImportOpen(true)} disabled={blocked} />
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
          <AddTeamMemberDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            organizationId={organizationId}
            onReviewEvidence={setReviewIds}
          />
          <ImportTeamMembersDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            organizationId={organizationId}
            onReviewEvidence={setReviewIds}
          />
          <ReviewEvidencePackDialog
            organizationId={organizationId}
            userIds={reviewIds}
            onClose={() => setReviewIds([])}
          />
        </>
      )}
    </>
  );
}
