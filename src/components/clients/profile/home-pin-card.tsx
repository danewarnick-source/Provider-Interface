// Service address on the client profile: address, pin and clock-in radius,
// then the extra service locations (client_approved_locations) — other places
// staff may clock in for this client. The punch pad enforces the circle only
// for EVV codes (isEvvLockedCode); it compares live GPS to
// clients.home_latitude / home_longitude using clients.geofence_radius_feet
// (default 1000), and counts a fix inside any active extra location's circle
// as inside (recording matched_approved_location_id). Editors only can change
// them; extra locations are ended (archived_at), never deleted.

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { House, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_GEOFENCE_RADIUS_FEET,
  isHomePinDraftDirty,
  resolveGeofenceRadiusFeet,
} from "@/lib/geo";
import {
  APPROVED_LOCATION_COLUMNS,
  LOCATION_NEEDS_PIN,
  activeLocations,
  locationReasonLabel,
  type ApprovedLocation,
  type LocationDraft,
} from "@/lib/clients/locations";
import {
  addServiceLocation,
  endServiceLocation,
  updateServiceLocation,
} from "@/lib/clients/locations.functions";
import { useAccess } from "@/hooks/use-access";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { EvvNote } from "@/components/clients/profile/details/evv-note";
import { LocationDialog } from "@/components/clients/profile/details/location-dialog";
import { useHomePin } from "./use-home-pin";
import "leaflet/dist/leaflet.css";

type HomePinMapProps = {
  lat: number | null;
  lng: number | null;
  radiusFeet: number;
  onPick: (lat: number, lng: number) => void;
};

const RADIUS_PRESETS_FT = [100, 300, 1000, 1500] as const;

function radiusLabel(feet: number): string {
  const formatted = feet.toLocaleString();
  if (feet === DEFAULT_GEOFENCE_RADIUS_FEET) {
    return `${formatted} ft (default)`;
  }
  return `${formatted} ft`;
}

/** The client's active extra service locations, with add / change / end. */
function useServiceLocations(orgId: string, clientId: string) {
  const qc = useQueryClient();
  const addFn = useServerFn(addServiceLocation);
  const updateFn = useServerFn(updateServiceLocation);
  const endFn = useServerFn(endServiceLocation);
  const [dialog, setDialog] = useState<{ location: ApprovedLocation | null } | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const key = ["client-service-locations", clientId];
  const scope = { organizationId: orgId, clientId };

  const list = useQuery({
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
  const open = (location: ApprovedLocation | null) => {
    setNeedsPin(false);
    setDialog({ location });
  };

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
    onError: (e: Error) => {
      if (e.message === LOCATION_NEEDS_PIN) setNeedsPin(true);
      else toast.error(e.message);
    },
  });
  const end = useMutation({
    mutationFn: (id: string) => endFn({ data: { ...scope, locationId: id } }),
    onSuccess: () => {
      toast.success("Location ended. Past clock-ins there keep their record.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { list, dialog, setDialog, needsPin, open, save, end };
}

export function HomePinCard({
  orgId,
  clientId,
  codes,
}: {
  orgId: string;
  clientId: string;
  codes: readonly string[];
}) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const { q, saveAddr, savePin, saveRadius } = useHomePin(clientId);
  const extra = useServiceLocations(orgId, clientId);
  const locations = extra.list.data ?? [];

  const [address, setAddress] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [MapEl, setMapEl] = useState<ComponentType<HomePinMapProps> | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    void import("./home-pin-map")
      .then((m) => {
        if (!cancelled) setMapEl(() => m.default);
      })
      .catch((err: Error) => {
        if (!cancelled) setMapError(err.message || "Map failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addr = address ?? q.data?.physical_address ?? "";
  const savedLat = q.data?.home_latitude;
  const savedLng = q.data?.home_longitude;
  const radius = resolveGeofenceRadiusFeet(q.data?.geofence_radius_feet);
  const saved =
    typeof savedLat === "number" && typeof savedLng === "number"
      ? { lat: Number(savedLat), lng: Number(savedLng) }
      : null;
  const pin = draft ?? saved;
  const dirty = isHomePinDraftDirty(draft, saved);
  const addrDirty = address !== null && address.trim() !== (q.data?.physical_address ?? "").trim();

  const radiusOptions = useMemo(() => {
    const set = new Set<number>(RADIUS_PRESETS_FT);
    set.add(radius);
    return [...set].sort((a, b) => a - b);
  }, [radius]);

  useEffect(() => {
    setDraft(null);
  }, [savedLat, savedLng]);

  return (
    <SectionCard
      icon={House}
      tone="profile"
      title="Service address"
      description="Where services happen, with the pin and clock-in circle on the map."
      id="home-location"
      testId="home-location-section"
      actions={
        canEdit ? (
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 max-md:h-11 max-md:w-11"
            aria-label="Add a service location"
            title="Add a service location"
            onClick={() => extra.open(null)}
            data-testid="add-service-location"
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null
      }
    >
      <EvvNote codes={codes} />
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="home-pin-address" className="text-xs">
            Physical address
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="home-pin-address"
              value={addr}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, ST ZIP"
              disabled={q.isLoading || !canEdit}
            />
            {canEdit ? (
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => saveAddr.mutate(addr.trim(), { onSuccess: () => setAddress(null) })}
                disabled={saveAddr.isPending || !addrDirty || !addr.trim()}
              >
                {saveAddr.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Save address
              </Button>
            ) : null}
          </div>
        </div>

        {locations.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium">Other service locations</p>
            <ul className="divide-y divide-border/60" data-testid="client-service-locations">
              {locations.map((l) => {
                const reason = locationReasonLabel(l);
                return (
                  <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.address ?? "No address"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Within {l.geofence_radius_feet.toLocaleString()} ft
                        {reason ? ` · ${reason}` : " · No reason recorded"}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <EditButton label={`Edit ${l.label}`} onClick={() => extra.open(l)} />
                        <RowMenu
                          label={`More actions for ${l.label}`}
                          items={[
                            {
                              label: "Stop clock-ins here",
                              danger: true,
                              disabled: extra.end.isPending,
                              onSelect: () =>
                                window.confirm(`Stop allowing clock-in at ${l.label}?`) &&
                                extra.end.mutate(l.id),
                            },
                          ]}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="home-pin-radius" className="text-xs">
            Clock-in geofence radius (feet)
          </Label>
          <Select
            value={String(radius)}
            onValueChange={(v) => {
              const feet = Number(v);
              if (!Number.isFinite(feet) || feet === radius) return;
              saveRadius.mutate(feet);
            }}
            disabled={q.isLoading || saveRadius.isPending || !canEdit}
          >
            <SelectTrigger
              id="home-pin-radius"
              className="max-w-xs"
              data-testid="geofence-radius-feet"
            >
              <SelectValue placeholder={radiusLabel(DEFAULT_GEOFENCE_RADIUS_FEET)} />
            </SelectTrigger>
            <SelectContent>
              {radiusOptions.map((feet) => (
                <SelectItem key={feet} value={String(feet)}>
                  {radiusLabel(feet)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saveRadius.isPending ? (
            <p className="text-xs text-muted-foreground">Saving radius…</p>
          ) : null}
        </div>

        {mapError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Map could not load. {mapError}
          </div>
        ) : MapEl ? (
          <MapEl
            lat={pin?.lat ?? null}
            lng={pin?.lng ?? null}
            radiusFeet={radius}
            onPick={(nextLat, nextLng) => canEdit && setDraft({ lat: nextLat, lng: nextLng })}
          />
        ) : (
          <div className="flex h-[320px] items-center justify-center rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
            Loading map…
          </div>
        )}

        {dirty ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hive-gold bg-hive-gold-soft px-3 py-2"
            data-testid="home-pin-moved-banner"
          >
            <p className="text-sm font-medium text-hive-ink">
              The pin moved. Save it so clock-in uses this house.
            </p>
            <Button
              onClick={() =>
                pin && savePin.mutate({ ...pin, radius }, { onSuccess: () => setDraft(null) })
              }
              disabled={savePin.isPending}
              data-testid="save-home-pin"
            >
              {savePin.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Save this pin
            </Button>
          </div>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            {pin
              ? `Saved pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
              : canEdit
                ? "No pin yet. Tap the map, then save."
                : "No pin yet."}
          </p>
        )}
      </div>
      <LocationDialog
        open={!!extra.dialog}
        location={extra.dialog?.location ?? null}
        saving={extra.save.isPending}
        needsPin={extra.needsPin}
        onOpenChange={(o) => !o && extra.setDialog(null)}
        onSave={(d) => extra.save.mutate(d)}
      />
    </SectionCard>
  );
}
