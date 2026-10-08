import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAgencySetupStatus } from "@/lib/agency-setup-gate.functions";
import { assertAgencySetupComplete } from "@/lib/agency-setup-gate";
import { addClient, type AddClientResult } from "@/lib/clients/create.functions";
import type { AddClientForm } from "@/lib/clients/create";

/** Save the Add client form; on success the sheet offers "Finish setting up" or "Later". */
export function useAddClient(
  organizationId: string,
  {
    onCreated,
    onDuplicate,
  }: {
    onCreated: (created: { id: string; pinFound: boolean }) => void;
    onDuplicate: (existing: { id: string; name: string }) => void;
  },
) {
  const qc = useQueryClient();
  const loadSetup = useServerFn(getAgencySetupStatus);
  const addClientFn = useServerFn(addClient);

  return useMutation({
    mutationFn: async (form: AddClientForm): Promise<AddClientResult> => {
      assertAgencySetupComplete(await loadSetup({ data: { organizationId } }));
      return addClientFn({ data: { organizationId, form } });
    },
    onSuccess: (res) => {
      if (res.status === "duplicate") {
        onDuplicate(res.existing);
        return;
      }
      if (res.status === "invalid") {
        toast.error(`Please complete: ${res.problems.join(", ")}.`);
        return;
      }
      qc.invalidateQueries({ queryKey: ["clients"] });
      onCreated({ id: res.id, pinFound: res.pinFound });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
