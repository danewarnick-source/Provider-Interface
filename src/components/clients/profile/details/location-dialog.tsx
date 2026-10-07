// Add or change one extra service location: name, street address and how
// close staff must be to clock in. The address is turned into a pin on save.

import { useEffect, useState } from "react";
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
  LOCATION_RADIUS_DEFAULT_FEET,
  LOCATION_RADIUS_MAX_FEET,
  LOCATION_RADIUS_MIN_FEET,
  cleanLocationDraft,
  type ApprovedLocation,
  type LocationDraft,
} from "@/lib/clients/locations";

export function LocationDialog({
  open,
  location,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  /** null = add a new location. */
  location: ApprovedLocation | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: LocationDraft) => void;
}) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(String(LOCATION_RADIUS_DEFAULT_FEET));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(location?.label ?? "");
    setAddress(location?.address ?? "");
    setRadius(String(location?.geofence_radius_feet ?? LOCATION_RADIUS_DEFAULT_FEET));
    setError(null);
  }, [open, location]);

  const submit = () => {
    const r = cleanLocationDraft({ label, address, radiusFeet: Number(radius) });
    if (!r.ok) return setError(r.error);
    setError(null);
    onSave(r.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {location ? "Change service location" : "Add a service location"}
          </DialogTitle>
          <DialogDescription>
            Staff can clock in for this client here as well as at home (for example a day program or
            job site).
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
            <Input id="loc-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
