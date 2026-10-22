// Add or change one extra service location: name, street address, why staff
// clock in there, and how close they must be. The server turns the address
// into a pin on save; when it can't (needsPin), the admin drops one on the map.

import { useEffect, useState, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LOCATION_NEEDS_PIN,
  LOCATION_RADIUS_DEFAULT_FEET,
  LOCATION_RADIUS_MAX_FEET,
  LOCATION_RADIUS_MIN_FEET,
  LOCATION_REASONS,
  LOCATION_REASON_NOTE_MAX,
  cleanLocationDraft,
  type ApprovedLocation,
  type LocationDraft,
  type LocationPin,
} from "@/lib/clients/evv/locations";

type PinMapProps = {
  lat: number | null;
  lng: number | null;
  radiusFeet: number;
  onPick: (lat: number, lng: number) => void;
};

export function LocationDialog({
  open,
  location,
  saving,
  needsPin,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  /** null = add a new location. */
  location: ApprovedLocation | null;
  saving: boolean;
  /** The last save couldn't geocode the address: ask for a pin. */
  needsPin: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: LocationDraft) => void;
}) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(String(LOCATION_RADIUS_DEFAULT_FEET));
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [pin, setPin] = useState<LocationPin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [MapEl, setMapEl] = useState<ComponentType<PinMapProps> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(location?.label ?? "");
    setAddress(location?.address ?? "");
    setRadius(String(location?.geofence_radius_feet ?? LOCATION_RADIUS_DEFAULT_FEET));
    setReason(location?.reason ?? "");
    setReasonNote(location?.reason_note ?? "");
    setPin(null);
    setError(null);
  }, [open, location]);

  useEffect(() => {
    if (!needsPin || MapEl || typeof window === "undefined") return;
    let cancelled = false;
    void import("../home-pin-map").then((m) => {
      if (!cancelled) setMapEl(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, [needsPin, MapEl]);

  const submit = () => {
    if (needsPin && !pin) return setError(LOCATION_NEEDS_PIN);
    const r = cleanLocationDraft({
      label,
      address,
      radiusFeet: Number(radius),
      reason,
      reasonNote,
      pin,
    });
    if (!r.ok) return setError(r.error);
    setError(null);
    onSave(r.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {location ? "Change service location" : "Add a service location"}
          </DialogTitle>
          <DialogDescription>
            Staff can clock in for this client here as well as at the service address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="loc-label">Name</Label>
            <Input
              id="loc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Day program"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="loc-address">Street address</Label>
            <Input
              id="loc-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setPin(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="loc-reason">Reason</Label>
            <select
              id="loc-reason"
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="location-reason"
            >
              <option value="" disabled>
                Choose a reason
              </option>
              {LOCATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {reason === "other" ? (
            <div className="space-y-1">
              <Label htmlFor="loc-reason-note">Note</Label>
              <Input
                id="loc-reason-note"
                value={reasonNote}
                maxLength={LOCATION_REASON_NOTE_MAX}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Why staff clock in here"
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="loc-radius">Clock-in distance (feet)</Label>
            <Input
              id="loc-radius"
              type="number"
              min={LOCATION_RADIUS_MIN_FEET}
              max={LOCATION_RADIUS_MAX_FEET}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>
          {needsPin ? (
            <div className="space-y-1" data-testid="location-drop-pin">
              <p className="text-sm text-hive-ink">{LOCATION_NEEDS_PIN}</p>
              {MapEl ? (
                <MapEl
                  lat={pin?.lat ?? null}
                  lng={pin?.lng ?? null}
                  radiusFeet={Number(radius) || LOCATION_RADIUS_DEFAULT_FEET}
                  onPick={(lat, lng) => setPin({ lat, lng })}
                />
              ) : (
                <div className="flex h-[240px] items-center justify-center rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
                  Loading map…
                </div>
              )}
              <p className="font-mono text-[11px] text-muted-foreground">
                {pin ? `Pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Tap the map to drop a pin."}
              </p>
            </div>
          ) : null}
          {error && error !== LOCATION_NEEDS_PIN ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
