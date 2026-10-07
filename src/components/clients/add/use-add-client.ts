import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAgencySetupStatus } from "@/lib/agency-setup-gate.functions";
import { assertAgencySetupComplete } from "@/lib/agency-setup-gate";
import { addClient, type AddClientResult } from "@/lib/clients/create.functions";
import type { AddClientForm } from "@/lib/clients/create";

/** Save the Add client form; on success open the new client's profile. */
export function useAddClient(
  organizationId: string,
  {
    onDone,
    onDuplicate,
  }: {
    onDone: () => void;
    onDuplicate: (existing: { id: string; name: string }) => void;
  },
) {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
      toast.success(
        res.pinFound
          ? "Client added."
          : "Client added. The address couldn't be pinned on the map — set the home pin on their profile.",
      );
      qc.invalidateQueries({ queryKey: ["clients"] });
      onDone();
      navigate({
        to: "/dashboard/clients/$clientId",
        params: { clientId: res.id },
        search: { tab: "overview" },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
