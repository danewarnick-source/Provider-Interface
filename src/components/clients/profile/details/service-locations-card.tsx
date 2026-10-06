// Extra service locations (client_approved_locations): places besides home
// where staff may clock in for this client. The punch pad checks each
// active one's geofence. Add, change or end — never delete.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import {
  APPROVED_LOCATION_COLUMNS,
  activeLocations,
  type ApprovedLocation,
  type LocationDraft,
} from "@/lib/clients/locations";
import {
  addServiceLocation,
  endServiceLocation,
  updateServiceLocation,
} from "@/lib/clients/locations.functions";
import { CardShell } from "@/components/clients/profile/cards/card-shell";
import { LocationDialog } from "./location-dialog";

export function ServiceLocationsCard({ orgId, clientId }: { orgId: string; clientId: string }) {
  const qc = useQueryClient();
  const canEdit = useAccess().canCategory("clients", "edit");
  const addFn = useServerFn(addServiceLocation);
  const updateFn = useServerFn(updateServiceLocation);
  const endFn = useServerFn(endServiceLocation);
  const [dialog, setDialog] = useState<{ location: ApprovedLocation | null } | null>(null);
  const key = ["client-service-locations", clientId];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_approved_locations")
        .select(APPROVED_LOCATION_COLUMNS)
        .eq("organization_id", orgId)
        .eq("client_id", clientId);
      if (error) throw error;
      return activeLocations((data ?? []) as ApprovedLocation[]);
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["client-approved-locations", clientId] });
  };
  const scope = { organizationId: orgId, clientId };

  const save = useMutation({
    mutationFn: async (draft: LocationDraft) => {
      const id = dialog?.location?.id;
      if (id) await updateFn({ data: { ...scope, locationId: id, location: draft } });
      else await addFn({ data: { ...scope, location: draft } });
    },
    onSuccess: () => {
      toast.success("Service location saved.");
      setDialog(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const end = useMutation({
    mutationFn: (id: string) => endFn({ data: { ...scope, locationId: id } }),
    onSuccess: () => {
      toast.success("Location ended. Past clock-ins there keep their record.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const locations = q.data ?? [];
  return (
    <CardShell
      title="Extra service locations"
      subtitle="Other places staff can clock in for this client."
      headerRight={
        canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setDialog({ location: null })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        ) : null
      }
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">None. Staff can only clock in at home.</p>
      ) : (
        <ul className="divide-y divide-border/60" data-testid="client-service-locations">
          {locations.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.address ?? "No address"} · within {l.geofence_radius_feet} ft
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Change ${l.label}`}
                    onClick={() => setDialog({ location: l })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`End ${l.label}`}
                    disabled={end.isPending}
                    onClick={() =>
                      window.confirm(`Stop allowing clock-in at ${l.label}?`) && end.mutate(l.id)
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <LocationDialog
        open={!!dialog}
        location={dialog?.location ?? null}
        saving={save.isPending}
        onOpenChange={(o) => !o && setDialog(null)}
        onSave={(d) => save.mutate(d)}
      />
    </CardShell>
  );
}
