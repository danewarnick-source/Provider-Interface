// "Person prefers no photo": saves the answer (the photo stops counting in
// Needs attention) and marks the Client file's photo row Not needed through
// the Evidence server functions (C5's waiver). Turning it back off undoes
// that waiver if it was this one.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { loadClientFile } from "@/lib/clients/file-evidence.functions";
import { removeEvidenceRequirement, restoreEvidenceRequirement } from "@/lib/evidence.functions";
import { clientFileKey } from "@/components/clients/profile/file/use-client-file";
import { useSaveSupportScope } from "./use-support-scope";

export const NO_PHOTO_REASON = "Person prefers no photo";

export function useNoPhoto(orgId: string, clientId: string) {
  const qc = useQueryClient();
  const save = useSaveSupportScope(orgId, clientId);
  const loadFn = useServerFn(loadClientFile);
  const skipFn = useServerFn(removeEvidenceRequirement);
  const restoreFn = useServerFn(restoreEvidenceRequirement);

  async function waive(noPhoto: boolean) {
    const file = await loadFn({ data: { organizationId: orgId, clientId } });
    const row = file.groups.flatMap((g) => g.rows).find((r) => r.key === "client_photo");
    if (!row?.itemId) return;
    const scope = { organizationId: orgId, itemId: row.itemId };
    if (noPhoto && row.state !== "not_needed") {
      await skipFn({ data: { ...scope, reason: NO_PHOTO_REASON } });
    } else if (!noPhoto && row.state === "not_needed" && row.reason === NO_PHOTO_REASON) {
      await restoreFn({ data: scope });
    }
  }

  return useMutation({
    mutationFn: async (noPhoto: boolean) => {
      await save.mutateAsync({ answers: { no_photo: noPhoto } });
      try {
        await waive(noPhoto);
      } catch {
        toast.message(
          "Saved. An owner or admin can mark the photo Not needed in the Client file.",
        );
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientFileKey(clientId) }),
  });
}
