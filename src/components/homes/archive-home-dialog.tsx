// Archive home: says what happens, asks for a required reason, then archives
// (teams.active = false with when and why; the home stays on record) and goes
// back to the list with "Home archived". The ⋯ menu only offers it when nobody
// lives at the home; the server refuses otherwise too.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { archiveReason } from "@/lib/homes/home-setup";
import { archiveHome } from "@/lib/homes/homes.functions";
import { useRefreshHomes } from "./use-homes";

export function ArchiveHomeDialog({
  orgId,
  teamId,
  name,
  onClose,
}: {
  orgId: string;
  teamId: string;
  name: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const navigate = useNavigate();
  const refresh = useRefreshHomes();
  const archiveFn = useServerFn(archiveHome);
  const archive = useMutation({
    mutationFn: () => archiveFn({ data: { organizationId: orgId, teamId, reason } }),
    onSuccess: () => {
      toast.success("Home archived");
      refresh();
      onClose();
      void navigate({ to: "/dashboard/settings/homes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const check = archiveReason(reason);
  const dirty = !!reason.trim();
  const keepOpen = (e: Event) => {
    if (dirty) e.preventDefault();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dirty && onClose()}>
      <DialogContent onInteractOutside={keepOpen} onEscapeKeyDown={keepOpen}>
        <DialogHeader>
          <DialogTitle>Archive {name}?</DialogTitle>
          <DialogDescription>
            It leaves the homes list, the scheduler and the Home pickers. Its staffing needs and
            history stay on record, and Restore brings it back.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="archive-home-reason">Reason</Label>
          <Textarea
            id="archive-home-reason"
            autoFocus
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Closed the house; residents moved to Maple House"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={archive.isPending}>
            Keep the home
          </Button>
          <Button
            variant="destructive"
            disabled={!check.ok || archive.isPending}
            title={check.ok ? undefined : check.error}
            onClick={() => archive.mutate()}
          >
            {archive.isPending ? "Archiving…" : "Archive home"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
