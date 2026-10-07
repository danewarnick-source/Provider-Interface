// Add client from a PCSP, last screen: what was saved and filed (kept on
// screen), then open the profile, where Nectar starts the About draft for a
// person to approve.
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filedReport, savedReport } from "@/lib/clients/pcsp/read-report";
import type { ReviewedPcsp } from "@/lib/clients/pcsp/review";
import type { NewClientSaved } from "./use-new-client-pcsp";

function Line({ ok, children }: { ok: boolean; children: string }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? "text-[var(--hive-ok)]" : "text-[var(--hive-danger)]"}`} />
      {children}
    </li>
  );
}

export function AddClientDone({
  saved,
  firstName,
  plan,
  onClose,
}: {
  saved: NewClientSaved;
  firstName: string;
  plan: ReviewedPcsp["plan"];
  onClose: () => void;
}) {
  const p = saved.plan;
  return (
    <div className="space-y-4" data-testid="add-client-done">
      <ul className="space-y-2">
        <Line ok>{`${firstName} is added.`}</Line>
        {p.ok ? (
          <>
            <Line ok>{savedReport(p.saved, plan)}</Line>
            <Line ok={typeof p.filed === "string"}>{filedReport(p.filed)}</Line>
          </>
        ) : (
          <Line ok={false}>
            {`The plan wasn't saved: ${p.message.trim().replace(/\.?$/, ".")} Open Plans on their profile and upload the PCSP again.`}
          </Line>
        )}
        {!saved.pinFound && (
          <Line ok={false}>The address couldn't be pinned on the map. Set the home pin on their profile.</Line>
        )}
      </ul>
      {p.ok && (
        <p className="text-xs text-muted-foreground">
          Their profile opens with Nectar drafting “About {firstName}” from the PCSP. Nothing is saved until you approve it.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 max-md:[&_a]:min-h-11 max-md:[&_button]:min-h-11">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button asChild data-testid="add-client-open-profile">
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId: saved.id }}
            search={p.ok ? { section: "profile", about: "draft" } : { section: "plans" }}
            onClick={onClose}
          >
            {p.ok ? `Open ${firstName}'s profile` : `Open ${firstName}'s Plans`}
          </Link>
        </Button>
      </div>
    </div>
  );
}
