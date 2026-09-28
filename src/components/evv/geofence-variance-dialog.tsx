import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export type GeofenceVariance = {
  distanceFeet?: number;
  limitFeet?: number;
  pos: { lat: number; lng: number; acc: number } | null;
  frameBlocked?: boolean;
};

interface GeofenceVarianceDialogProps {
  mode: "clock-in" | "clock-out";
  variance: GeofenceVariance | null;
  reason: string;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function GeofenceVarianceDialog({
  mode,
  variance,
  reason,
  busy,
  onReasonChange,
  onCancel,
  onConfirm,
}: GeofenceVarianceDialogProps) {
  const isClockIn = mode === "clock-in";
  const minimumLength = isClockIn ? 10 : 5;
  const reasonId = isClockIn ? "variance-reason" : "out-variance-reason";

  return (
    <Dialog open={!!variance} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {variance?.frameBlocked ? "GPS unavailable" : "Outside the geofence"}
          </DialogTitle>
          <DialogDescription>
            {variance?.frameBlocked
              ? `GPS could not be captured. ${isClockIn ? "Clock-in" : "Clock-out"} is held until a live location is available — enable location and retry.`
              : "This check is against the home pin saved on the client record — not a sign that GPS is off. If you are standing at the house, ask an administrator to update that pin."}
          </DialogDescription>
        </DialogHeader>

        {variance &&
          (isClockIn
            ? typeof variance.distanceFeet === "number" &&
              typeof variance.limitFeet === "number" && <DistanceSummary variance={variance} />
            : !variance.frameBlocked && <DistanceSummary variance={variance} />)}

        <div className="grid gap-2">
          <Label htmlFor={reasonId}>Why are you outside the geofence?</Label>
          <Textarea
            id={reasonId}
            rows={4}
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder={`Write why you are ${isClockIn ? "clocking in" : "clocking out"} away from the saved home pin.`}
            maxLength={500}
          />
          {isClockIn && (
            <p className="text-[11px] text-muted-foreground">
              {reason.trim().length}/10 characters minimum
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy || reason.trim().length < minimumLength}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isClockIn ? "Confirm Clock In & Start Shift" : "Submit & Clock Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DistanceSummary({ variance }: { variance: GeofenceVariance }) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
      {typeof variance.distanceFeet === "number" ? (
        <>
          Distance from the saved home pin:{" "}
          <span className="font-mono font-semibold">
            {variance.distanceFeet.toLocaleString()} ft
          </span>{" "}
          · Allowed:{" "}
          <span className="font-mono font-semibold">
            {(variance.limitFeet ?? 0).toLocaleString()} ft
          </span>
        </>
      ) : (
        <>
          GPS accuracy too low to confirm location. A written variance is required. · Allowed:{" "}
          <span className="font-mono font-semibold">
            {(variance.limitFeet ?? 0).toLocaleString()} ft
          </span>
        </>
      )}
    </div>
  );
}
