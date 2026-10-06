// ⋯ menu on the client profile header: Face sheet PDF, Update from a
// document, Discharge, Reactivate. Discharge here only records the date and
// moves the client to Discharged (records are kept; the guided discharge
// flow replaces this in a later step).

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccess } from "@/hooks/use-access";
import { todayYmd } from "@/lib/clients/dates";
import { updateClient } from "@/lib/clients/writes.functions";
import { UpdateFromDocumentDialog } from "@/components/clients/dialogs/update-from-document-dialog";
import { useOpenFaceSheet } from "./face-sheet-button";
import type { ClientProfileData } from "./use-client-profile";

export function HeaderMenu({
  orgId,
  data,
  discharged,
  onChanged,
}: {
  orgId: string;
  data: ClientProfileData;
  discharged: boolean;
  onChanged: () => void;
}) {
  const { canCategory } = useAccess();
  const clientId = data.client.id;
  const faceSheet = useOpenFaceSheet(clientId);
  const updateFn = useServerFn(updateClient);
  const [updating, setUpdating] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [date, setDate] = useState(todayYmd());

  const canMedical = canCategory("client_medical");
  const canEdit = canCategory("clients", "edit");

  const status = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateFn({ data: { organizationId: orgId, clientId, patch } }),
    onSuccess: (_r, patch) => {
      toast.success(
        patch.account_status === "active"
          ? `${data.name} is active again.`
          : `${data.name} is discharged. The record is kept.`,
      );
      setDischarging(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canMedical && !canEdit) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="More actions"
            data-testid="client-profile-menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMedical ? (
            <DropdownMenuItem disabled={faceSheet.busy} onSelect={() => void faceSheet.open()}>
              {faceSheet.busy ? "Building face sheet…" : "Face sheet PDF"}
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setUpdating(true)}>
              Update from a document
            </DropdownMenuItem>
          ) : null}
          {canEdit && !discharged ? (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => {
                setDate(todayYmd());
                setDischarging(true);
              }}
            >
              Discharge
            </DropdownMenuItem>
          ) : null}
          {canEdit && discharged ? (
            <DropdownMenuItem
              disabled={status.isPending}
              onSelect={() => status.mutate({ account_status: "active", discharge_date: null })}
            >
              Reactivate
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateFromDocumentDialog
        open={updating}
        onOpenChange={setUpdating}
        clientId={clientId}
        orgId={orgId}
        onApplied={onChanged}
      />

      <Dialog open={discharging} onOpenChange={setDischarging}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discharge {data.name}?</DialogTitle>
            <DialogDescription>
              They move to the Discharged list. Nothing is deleted: Medicaid requires client records
              be kept for 7 years. You can reactivate them later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="discharge-date">Discharge date</Label>
            <Input
              id="discharge-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDischarging(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!date || status.isPending}
              onClick={() => status.mutate({ account_status: "archived", discharge_date: date })}
            >
              {status.isPending ? "Saving…" : "Discharge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
