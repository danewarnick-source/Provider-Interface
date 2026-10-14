// Do-not-schedule list: team members who must never work with this client,
// and why. The scheduler refuses them and shows the reason. Adding someone
// already on the team takes them off the client's codes first. Entries are
// ended, never deleted.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { formatDate } from "@/lib/clients/dates";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXCLUSION_REASON_MAX } from "@/lib/clients/exclusions";
import { addStaffExclusion, endStaffExclusion } from "@/lib/clients/team.functions";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import { useOrgStaff, useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { useClientTeam } from "./use-client-team";
import { invalidateTeam } from "./team-changes";

export function DoNotScheduleCard({
  orgId,
  clientId,
  canEdit,
}: {
  orgId: string;
  clientId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const teamQ = useClientTeam(orgId, clientId);
  const staffQ = useOrgStaff(orgId);
  const endFn = useServerFn(endStaffExclusion);
  const addFn = useServerFn(addStaffExclusion);
  const unassignFn = useServerFn(setStaffClientCodes);
  const [adding, setAdding] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const exclusions = teamQ.data?.exclusions ?? [];
  const names = useProfileNames(exclusions.map((e) => e.staff_user_id)).data;
  const listed = new Set(exclusions.map((e) => e.staff_user_id));
  const onTeam = teamQ.data?.assigned.has(staffId) ?? false;

  const addM = useMutation({
    mutationFn: async () => {
      if (onTeam) {
        await unassignFn({ data: { organizationId: orgId, staffId, clientId, codes: [] } });
      }
      await addFn({ data: { organizationId: orgId, clientId, staffId, reason } });
    },
    onSuccess: () => {
      toast.success("Added to the do-not-schedule list");
      setAdding(false);
      setStaffId("");
      setReason("");
      invalidateTeam(qc);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidateTeam(qc);
    },
  });
  const endM = useMutation({
    mutationFn: (exclusionId: string) =>
      endFn({ data: { organizationId: orgId, clientId, exclusionId } }),
    onSuccess: () => {
      toast.success("Removed from the do-not-schedule list");
      invalidateTeam(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      icon={Ban}
      tone="ok"
      title="Do not schedule"
      description="Team members who must never work with this client, and why. The scheduler refuses them."
      testId="client-do-not-schedule"
      actions={
        canEdit ? (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add to do-not-schedule list
          </Button>
        ) : null
      }
    >
      {exclusions.length === 0 ? (
        <EmptyState>Nobody is on the list.</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {exclusions.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{names?.get(e.staff_user_id) ?? "Team member"}</p>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{e.reason}</p>
                <p className="text-[11px] text-muted-foreground">
                  Since {formatDate(e.created_at)}
                </p>
              </div>
              {canEdit ? (
                <RowMenu
                  label={`More actions for ${names?.get(e.staff_user_id) ?? "this team member"}`}
                  items={[
                    {
                      label: "Take off the list",
                      danger: true,
                      disabled: endM.isPending,
                      onSelect: () => endM.mutate(e.id),
                    },
                  ]}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to do-not-schedule list</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Team member</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Team member">
                  <SelectValue placeholder="Choose a team member" />
                </SelectTrigger>
                <SelectContent>
                  {(staffQ.data ?? [])
                    .filter((s) => !listed.has(s.id))
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {onTeam ? (
                <p className="text-xs font-medium text-[var(--hive-danger-fg)]">
                  This also takes them off the client's codes.
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exclusion-reason">Why</Label>
              <Textarea
                id="exclusion-reason"
                rows={3}
                value={reason}
                maxLength={EXCLUSION_REASON_MAX}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addM.mutate()}
              disabled={!staffId || !reason.trim() || addM.isPending}
            >
              {addM.isPending ? "Saving…" : "Add to list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
