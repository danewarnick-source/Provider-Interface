import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAgencySetupStatus } from "@/lib/agency-setup-gate.functions";
import { assertAgencySetupComplete } from "@/lib/agency-setup-gate";
import { createClient } from "@/lib/clients/writes.functions";
import { geocodeAddress } from "@/lib/geocode";
import { isDailyServiceCode } from "@/lib/service-billing";
import type { AddClientValues } from "./add-client-dialog";

// The home pin anchors the EVV geofence, so it only ever comes from the
// client's street address — never from the admin's own device location.
async function resolveCoords(addr: string): Promise<{ lat: number | null; lng: number | null }> {
  if (!addr?.trim()) return { lat: null, lng: null };
  const geo = await geocodeAddress(addr);
  return geo ? { lat: geo.lat, lng: geo.lng } : { lat: null, lng: null };
}

/** Quick-add a client from the directory, then land on intake or the new profile. */
export function useAddClient(
  organizationId: string | undefined,
  { onCreated, onDraftCreated }: {
    onCreated: () => void;
    onDraftCreated: (client: { id: string; name: string }) => void;
  },
) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loadSetup = useServerFn(getAgencySetupStatus);
  const createClientFn = useServerFn(createClient);

  return useMutation({
    mutationFn: async (input: AddClientValues) => {
      if (!organizationId) throw new Error("No organization selected.");
      assertAgencySetupComplete(await loadSetup({ data: { organizationId } }));
      const coords = await resolveCoords(input.physical_address);
      const isOwn = input.is_own_guardian ?? true;
      const stubCodes = (input.job_code ?? [])
        .map((c) => c.toUpperCase())
        .filter(Boolean)
        .map((service_code) => ({
          service_code,
          unit_type: (isDailyServiceCode(service_code) ? "day" : "unit") as "day" | "unit",
        }));
      const { id: newId } = await createClientFn({ data: { organizationId, stubCodes, values: {
        first_name:           input.first_name,
        last_name:            input.last_name,
        phone_number:         input.phone_number,
        physical_address:     input.physical_address,
        pcsp_goals:           input.pcsp_goals,
        authorized_dspd_codes: input.job_code,
        job_code:             input.job_code,
        medicaid_id:          input.medicaid_id,
        geofence_radius_feet: input.geofence_radius_feet,
        special_directions:   input.special_directions || null,
        date_of_birth:        input.date_of_birth || null,
        emergency_contact_name:  input.emergency_contact_name || null,
        emergency_contact_phone: input.emergency_contact_phone || null,
        home_latitude:        coords.lat,
        home_longitude:       coords.lng,
        intake_status:        input.intake_mode === "intake" ? "in_progress" : "pending",
        is_own_guardian:      isOwn,
        guardian_name:        isOwn ? null : (input.guardian_name?.trim() || null),
        guardian_phone:       isOwn ? null : (input.guardian_phone?.trim() || null),
        guardian_relationship:isOwn ? null : (input.guardian_relationship?.trim() || null),
        guardian_email:       isOwn ? null : (input.guardian_email?.trim() || null),
      } } });

      return { id: newId, mode: input.intake_mode, name: `${input.first_name} ${input.last_name}`.trim() };
    },
    onSuccess: ({ id, mode, name }) => {
      toast.success(
        mode === "intake"
          ? "Client created — starting intake. You can set Evidence packs from Evidence after intake."
          : "Draft client saved. Open Evidence to run the add-client questionnaire.",
      );
      qc.invalidateQueries({ queryKey: ["clients"] });
      onCreated();
      if (mode === "intake") {
        navigate({ to: "/dashboard/client-intake/$clientId", params: { clientId: id } });
      } else {
        // Land on the new client so the draft state (missing fields, intake_status=pending) is visible.
        navigate({ to: "/dashboard/clients/$clientId", params: { clientId: id }, search: { tab: "overview" } });
        // Open the intake checklist panel so incomplete items are immediately visible.
        onDraftCreated({ id, name });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
