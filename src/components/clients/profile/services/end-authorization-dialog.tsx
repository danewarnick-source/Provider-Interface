// End an authorization: sets its end date. The row stays on file (7-year
// retention); after the end date no new shifts or billing use the code.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { endProblems, type AuthorizationRow } from "@/lib/clients/authorizations";
import { todayYmd } from "@/lib/clients/dates";
import { endAuthorization } from "@/lib/clients/services.functions";

export function EndAuthorizationDialog({
  orgId,
  clientId,
  row,
  onClose,
  onSaved,
}: {
  orgId: string;
  clientId: string;
  row: AuthorizationRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const endFn = useServerFn(endAuthorization);
  const [endOn, setEndOn] = useState(todayYmd());
  const [saving, setSaving] = useState(false);
  const problems = endProblems(row, endOn);

  async function save() {
    setSaving(true);
    try {
      await endFn({ data: { organizationId: orgId, clientId, id: row.id, endOn } });
      toast.success(`${row.service_code} ends ${endOn}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't end the authorization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md" data-testid="end-authorization-dialog">
        <DialogHeader>
          <DialogTitle>End {row.service_code}</DialogTitle>
          <DialogDescription>
            The authorization stays on file for audits. From the end date, no new shifts or billing
            can use {row.service_code}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="end-on" className="text-xs">
            End date
          </Label>
          <Input
            id="end-on"
            type="date"
            value={endOn}
            min={row.service_start_date ?? undefined}
            onChange={(e) => setEndOn(e.target.value)}
          />
        </div>
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-destructive">{problems[0] ?? ""}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || problems.length > 0}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}End authorization
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
