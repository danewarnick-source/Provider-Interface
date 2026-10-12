// The service address, pin and clock-in radius for one client, with the
// three saves the Service address card makes (home-pin.functions.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  saveClientGeofenceRadius,
  saveClientHomePin,
  saveClientPhysicalAddress,
} from "@/lib/clients/home-pin.functions";

export type HomePinRow = {
  physical_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  geofence_radius_feet: number | null;
};

export function useHomePin(clientId: string) {
  const qc = useQueryClient();
  const savePinFn = useServerFn(saveClientHomePin);
  const saveRadiusFn = useServerFn(saveClientGeofenceRadius);
  const saveAddrFn = useServerFn(saveClientPhysicalAddress);
  const key = ["client-home-pin", clientId];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("physical_address, home_latitude, home_longitude, geofence_radius_feet")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as HomePinRow | null;
    },
  });

  const patch = (p: Partial<HomePinRow>) => {
    qc.setQueryData(key, (old: HomePinRow | null | undefined) => (old ? { ...old, ...p } : old));
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["client-profile"] });
    void qc.invalidateQueries({ queryKey: ["client-profile-tab"] });
    void qc.invalidateQueries({ queryKey: ["caseload"] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const saveAddr = useMutation({
    mutationFn: (address: string) => saveAddrFn({ data: { clientId, address } }),
    onSuccess: (r) => {
      toast.success("Address saved.");
      patch({ physical_address: r.address });
    },
    onError,
  });

  const savePin = useMutation({
    mutationFn: (a: { lat: number; lng: number; radius: number }) =>
      savePinFn({
        data: { clientId, latitude: a.lat, longitude: a.lng, geofenceRadiusFeet: a.radius },
      }),
    onSuccess: (r) => {
      toast.success("Home pin saved. Clock-in will use this house.");
      patch({
        home_latitude: r.latitude,
        home_longitude: r.longitude,
        ...(r.geofenceRadiusFeet != null ? { geofence_radius_feet: r.geofenceRadiusFeet } : {}),
      });
    },
    onError,
  });

  const saveRadius = useMutation({
    mutationFn: (feet: number) => saveRadiusFn({ data: { clientId, geofenceRadiusFeet: feet } }),
    onSuccess: (r) => {
      toast.success(`Clock-in radius set to ${r.geofenceRadiusFeet.toLocaleString()} ft.`);
      patch({ geofence_radius_feet: r.geofenceRadiusFeet });
    },
    onError,
  });

  return { q, saveAddr, savePin, saveRadius };
}
