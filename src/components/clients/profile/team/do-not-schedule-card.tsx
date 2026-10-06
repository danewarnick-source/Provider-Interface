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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card data-testid="client-do-not-schedule">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ban className="h-4 w-4" /> Do not schedule
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            The scheduler won't place these team members with this client and says why.
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {exclusions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is on the list.</p>
        ) : (
          <ul className="divide-y rounded border">
            {exclusions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{names?.get(e.staff_user_id) ?? "Team member"}</p>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{e.reason}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Since {new Date(e.created_at).toLocaleDateString()}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={endM.isPending}
                    onClick={() => endM.mutate(e.id)}
                  >
                    End
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
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
                <p className="text-xs text-amber-700 dark:text-amber-400">
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
    </Card>
  );
}
