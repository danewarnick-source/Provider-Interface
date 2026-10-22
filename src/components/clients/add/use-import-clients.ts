import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAgencySetupStatus } from "@/lib/agency-setup-gate.functions";
import { assertAgencySetupComplete } from "@/lib/agency-setup-gate";
import { addClient, findClientsByMedicaidIds } from "@/lib/clients/create.functions";
import {
  clientImportForm,
  type ClientImportAgency,
  type ClientImportDraft,
  type ExistingMedicaid,
} from "@/lib/clients/import-sheet";

export type ImportOutcome =
  | { status: "created"; id: string; name: string }
  | { status: "skipped"; name: string; reason: string };

/** Clients here already using the file's Medicaid IDs. */
export function useExistingMedicaid(
  organizationId: string,
  rows: readonly ClientImportDraft[],
  enabled: boolean,
) {
  const fn = useServerFn(findClientsByMedicaidIds);
  const ids = [...new Set(rows.map((r) => r.medicaid_id.trim()).filter(Boolean))].sort();
  return useQuery({
    enabled: enabled && ids.length > 0,
    queryKey: ["clients", "import-medicaid", organizationId, ids],
    queryFn: async (): Promise<ExistingMedicaid[]> =>
      (await fn({ data: { organizationId, medicaidIds: ids } })).map((m) => ({
        medicaidId: m.medicaidId,
        name: m.name,
      })),
    staleTime: 30_000,
  });
}

/**
 * Save every reviewed row through addClient, one at a time (the same server
 * function and writes as Add client). A row that fails is reported, not retried.
 */
export function useImportClients(organizationId: string, agency: ClientImportAgency) {
  const qc = useQueryClient();
  const loadSetup = useServerFn(getAgencySetupStatus);
  const addFn = useServerFn(addClient);
  const [done, setDone] = useState(0);

  const mutation = useMutation({
    mutationFn: async (rows: ClientImportDraft[]): Promise<ImportOutcome[]> => {
      assertAgencySetupComplete(await loadSetup({ data: { organizationId } }));
      const out: ImportOutcome[] = [];
      setDone(0);
      for (const row of rows) {
        const name = `${row.first_name} ${row.last_name}`.trim();
        try {
          const res = await addFn({
            data: { organizationId, form: clientImportForm(row, agency) },
          });
          out.push(
            res.status === "created"
              ? { status: "created", id: res.id, name }
              : res.status === "duplicate"
                ? {
                    status: "skipped",
                    name,
                    reason: `Medicaid ID already used by ${res.existing.name}.`,
                  }
                : { status: "skipped", name, reason: `Missing ${res.problems.join(", ")}.` },
          );
        } catch (e) {
          out.push({ status: "skipped", name, reason: (e as Error).message });
        }
        setDone((n) => n + 1);
      }
      return out;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...mutation, done };
}
