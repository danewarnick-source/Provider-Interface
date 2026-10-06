// Small pieces of the Support strategies card: status badge, code coverage,
// the "upload the PCSP first" dialog and the uploaded-document check.

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientBillingCodes } from "@/components/clients/shared/hooks/use-client-billing-codes";
import { computeSupportStrategyCoverage } from "@/lib/clients/strategy-coverage";
import type { CSTContent, CSTSection } from "@/lib/clients/training.functions";

/** A strategies "document" that is just one uploaded file link. */
export function isUploadDoc(content: CSTContent): boolean {
  const s = content?.sections ?? [];
  return s.length === 1 && s[0].items.length === 1 && s[0].items[0].kind === "link";
}

export function SSStatusBadge({ status, version }: { status: string; version: number }) {
  if (status === "published") {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Published v{version}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="border border-amber-200 bg-amber-100 text-amber-800">
      Draft v{version}
    </Badge>
  );
}

export function PcspFirstDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload the PCSP first</DialogTitle>
          <DialogDescription>
            This client has no PCSP on file. Support strategies and person-specific training are
            built from the PCSP, so upload it before drafting. Add it under Plans or the Client
            file.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Every active, non-exempt code must be covered by a published strategy section (§1.24(5)). */
export function SupportStrategyCoveragePanel({
  clientId,
  sections,
}: {
  clientId: string;
  sections: CSTSection[];
}) {
  const { data: billingCodes } = useClientBillingCodes(clientId);
  const coverage = useMemo(
    () =>
      computeSupportStrategyCoverage(
        (billingCodes ?? []).map((c) => c.service_code),
        sections,
      ),
    [billingCodes, sections],
  );
  if (coverage.covered.length === 0 && coverage.gaps.length === 0) return null;
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">Service code coverage (§1.24(5))</p>
      <div className="flex flex-wrap gap-1.5">
        {coverage.covered.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs text-emerald-800"
          >
            <CheckCircle2 className="h-3 w-3" />
            {c}
          </span>
        ))}
        {coverage.gaps.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-800"
          >
            <AlertTriangle className="h-3 w-3" />
            {c}
          </span>
        ))}
      </div>
      {coverage.gaps.length > 0 && (
        <p className="text-xs text-red-700">
          {coverage.gaps.join(", ")} {coverage.gaps.length === 1 ? "is" : "are"} not covered by any
          support strategy.
        </p>
      )}
    </div>
  );
}
