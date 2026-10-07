// Service address on the client profile: address, pin and clock-in radius.
// The punch pad enforces the circle only for EVV codes (isEvvLockedCode); it
// compares live GPS to clients.home_latitude / home_longitude using
// clients.geofence_radius_feet (default 1000). Editors only can change it.

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { House, Loader2 } from "lucide-react";
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
import { useAccess } from "@/hooks/use-access";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EvvNote } from "@/components/clients/profile/details/evv-note";
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

export function HomePinCard({ clientId, codes }: { clientId: string; codes: readonly string[] }) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const { q, saveAddr, savePin, saveRadius } = useHomePin(clientId);

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
    </SectionCard>
  );
}
