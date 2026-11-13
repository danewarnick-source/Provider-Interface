// Staffing needs on a staffed home: time blocks of days, start–end, staff
// needed and "awake overnight" (staffing-needs.ts). + Add a time block opens a
// new block in place with Days focused; the pencil edits a block in place;
// Remove takes it out with Undo. Not shown on host homes (hosts never clock).
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { blockText, emptyBlock, groupNeeds, type NeedBlock } from "@/lib/homes/staffing-needs";
import { removeStaffingNeed, saveStaffingNeed } from "@/lib/homes/staffing-needs.functions";
import type { HomeDetail } from "@/lib/homes/homes-load.server";
import { StaffingNeedEditor } from "./staffing-need-editor";
import { useRefreshHomes } from "./use-homes";

/** "new" while adding, a block's first row id while editing it. */
type Editing = string | null;

export function StaffingNeedsCard({
  orgId,
  detail,
  canEdit,
}: {
  orgId: string;
  detail: HomeDetail;
  canEdit: boolean;
}) {
  const teamId = detail.home.id;
  const blocks = groupNeeds(detail.needs);
  const [editing, setEditing] = useState<Editing>(null);
  const refresh = useRefreshHomes();
  const saveFn = useServerFn(saveStaffingNeed);
  const removeFn = useServerFn(removeStaffingNeed);
  const save = useMutation({
    mutationFn: (b: NeedBlock) =>
      saveFn({ data: { organizationId: orgId, teamId, replaceIds: b.ids, block: b } }),
    onSuccess: (_r, b) => {
      toast.success(b.ids.length ? "Staffing need saved" : "Staffing need added");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (b: NeedBlock) => removeFn({ data: { organizationId: orgId, teamId, ids: b.ids } }),
    onSuccess: (_r, b) => {
      refresh();
      toast.success("Staffing need removed", {
        action: { label: "Undo", onClick: () => save.mutate({ ...b, ids: [] }) },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const editable = canEdit && detail.home.active;
  const busy = save.isPending || remove.isPending;
  const addButton =
    editable && editing === null ? (
      <Button variant="outline" onClick={() => setEditing("new")}>
        <Plus className="h-4 w-4" /> Add a time block
      </Button>
    ) : null;

  return (
    <SectionCard
      icon={Clock}
      title="Staffing needs"
      description="How many staff this home needs, and when."
      actions={blocks.length ? addButton : null}
      testId="staffing-needs"
    >
      <div className="space-y-2">
        {blocks.length === 0 && editing !== "new" ? (
          <EmptyState action={addButton}>No staffing needs yet.</EmptyState>
        ) : null}
        {blocks.map((b) =>
          editing === b.ids[0] ? (
            <StaffingNeedEditor
              key={b.ids[0]}
              initial={b}
              saving={save.isPending}
              onSave={(next) => save.mutate(next)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              key={b.ids[0]}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-hive-border px-3 py-2"
            >
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium">{blockText(b)}</div>
                {b.notes ? <div className="text-xs text-muted-foreground">{b.notes}</div> : null}
              </div>
              {editable ? (
                <>
                  <EditButton label="Edit time block" onClick={() => setEditing(b.ids[0])} />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 max-md:h-11 max-md:w-11"
                    aria-label="Remove time block"
                    title="Remove time block"
                    disabled={busy}
                    onClick={() => remove.mutate(b)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          ),
        )}
        {editing === "new" ? (
          <StaffingNeedEditor
            initial={emptyBlock()}
            saving={save.isPending}
            onSave={(next) => save.mutate(next)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
