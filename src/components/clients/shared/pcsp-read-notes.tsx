// What a PCSP read did, kept on screen (not a toast): what was filled, why no
// codes were found, or why the read failed with "Try again".

import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PcspResult } from "@/lib/clients/pcsp/parser-shared";
import { readReport } from "@/lib/clients/pcsp/read-report";

const BOX = "flex items-start gap-2 rounded-xl border p-3 text-sm";

export function PcspReadSummary({ parse, agencyName }: { parse: PcspResult; agencyName: string }) {
  const report = readReport(parse, agencyName);
  return (
    <div className="space-y-2" data-testid="pcsp-read-summary">
      <p className={`${BOX} border-[var(--hive-ok)] bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]`}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        {report.line}
      </p>
      {report.noCodes && (
        <div className={`${BOX} flex-wrap border-hive-gold/50 bg-hive-gold-soft text-hive-ink`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{report.noCodes}</span>
          <Button asChild size="sm" variant="outline" className="max-md:min-h-11">
            <Link to="/dashboard/settings">Open agency settings</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export function PcspReadFailed({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className={`${BOX} flex-wrap border-[var(--hive-danger)] bg-[var(--hive-danger-soft)] text-[var(--hive-danger-fg)]`}
      data-testid="pcsp-read-failed"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <Button size="sm" variant="outline" className="max-md:min-h-11" disabled={retrying} onClick={onRetry}>
        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        Try again
      </Button>
    </div>
  );
}
