// ⋯ menu on the client profile header: Face sheet PDF, Update from a
// document, Discharge (the guided flow in ./discharge/), Reactivate.

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccess } from "@/hooks/use-access";
import { UpdateFromDocumentDialog } from "@/components/clients/dialogs/update-from-document-dialog";
import { useOpenFaceSheet } from "./face-sheet-button";
import type { ClientProfileData } from "./use-client-profile";
import { DischargeDialog } from "./discharge/discharge-dialog";
import { useDischargeWrites } from "./discharge/use-discharge";

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
  const [updating, setUpdating] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const { reactivate } = useDischargeWrites(orgId, clientId, onChanged);

  const canMedical = canCategory("client_medical");
  const canEdit = canCategory("clients", "edit");

  if (!canMedical && !canEdit) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 max-md:h-11 max-md:w-11"
            aria-label="More actions"
            data-testid="client-profile-menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMedical ? (
            <DropdownMenuItem disabled={faceSheet.busy} onSelect={() => void faceSheet.open()}>
              {faceSheet.busy ? "Building face sheet…" : "Open face sheet PDF"}
            </DropdownMenuItem>
          ) : null}
          {canEdit && !discharged ? (
            <DropdownMenuItem onSelect={() => setUpdating(true)}>
              Update from a document
            </DropdownMenuItem>
          ) : null}
          {canEdit && !discharged ? (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setDischarging(true)}
              data-testid="client-profile-discharge"
            >
              Discharge client
            </DropdownMenuItem>
          ) : null}
          {canEdit && discharged ? (
            <DropdownMenuItem
              onSelect={() => setReactivating(true)}
              data-testid="client-profile-reactivate"
            >
              Reactivate client
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

      <DischargeDialog
        open={discharging}
        onOpenChange={setDischarging}
        orgId={orgId}
        clientId={clientId}
        name={data.name}
        onChanged={onChanged}
      />

      <AlertDialog open={reactivating} onOpenChange={setReactivating}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate {data.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They move back to the active list and their record can be changed again. The discharge
              stays on file, and ended authorizations, cancelled shifts and the old team aren't
              brought back: add them again as needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reactivate.isPending}
              onClick={() =>
                reactivate.mutate(undefined, {
                  onSuccess: () => toast.success(`${data.name} is active again.`),
                  onError: (e: Error) => toast.error(e.message),
                })
              }
              data-testid="client-reactivate-confirm"
            >
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
