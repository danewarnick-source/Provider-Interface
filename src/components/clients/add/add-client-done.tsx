// Add client, last screen: what was saved (and, from a PCSP, what was filed),
// kept on screen, then the choice: "Finish setting up <first name> now" (the
// optional setup steps) or "Later" (their profile, with the "Finish setting
// up" banner). From a PCSP, the profile also starts Nectar's About draft for
// a person to approve.
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

export type AddedClient = {
  id: string;
  pinFound: boolean;
  /** Only when added from a PCSP. */
  pcsp: { plan: NewClientSaved["plan"]; reviewed: ReviewedPcsp["plan"] } | null;
};

export function AddClientDone({
  added,
  firstName,
  onClose,
}: {
  added: AddedClient;
  firstName: string;
  onClose: () => void;
}) {
  const p = added.pcsp?.plan ?? null;
  const search =
    p === null ? {} : p.ok ? { section: "profile" as const, about: "draft" as const } : { section: "plans" as const };
  return (
    <div className="space-y-4" data-testid="add-client-done">
      <ul className="space-y-2">
        <Line ok>{`${firstName} is added.`}</Line>
        {p?.ok ? (
          <>
            <Line ok>{savedReport(p.saved, added.pcsp!.reviewed)}</Line>
            <Line ok={typeof p.filed === "string"}>{filedReport(p.filed)}</Line>
          </>
        ) : p ? (
          <Line ok={false}>
            {`The plan wasn't saved: ${p.message.trim().replace(/\.?$/, ".")} Open Plans on their profile and upload the PCSP again.`}
          </Line>
        ) : null}
        {!added.pinFound && (
          <Line ok={false}>The address couldn't be pinned on the map. Set the home pin on their profile.</Line>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        Finish setting up adds their photo, contacts, health, team, behavior plan and client file,
        a few short questions at a time. Every step can be skipped.
        {p?.ok ? ` Nectar also drafts “About ${firstName}” from the PCSP; nothing is saved until you approve it.` : ""}
      </p>
      <div className="flex flex-wrap justify-end gap-2 max-md:[&_a]:min-h-11 max-md:[&_button]:min-h-11">
        <Button variant="outline" asChild>
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId: added.id }}
            search={search}
            onClick={onClose}
            data-testid="add-client-later"
          >
            Later
          </Link>
        </Button>
        <Button asChild>
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId: added.id }}
            search={{ ...search, setup: "open" as const }}
            onClick={onClose}
            data-testid="add-client-finish-setup"
          >
            Finish setting up {firstName} now
          </Link>
        </Button>
      </div>
    </div>
  );
}
