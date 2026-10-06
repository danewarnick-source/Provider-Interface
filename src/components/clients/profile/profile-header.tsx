// Client profile header: back link, photo, name, status, codes, home, plan
// year and support coordinator; the ⋯ menu holds the rarer actions.

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/person/person-avatar";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/clients/dates";
import { displayMedicaidId } from "@/lib/medicaid-id";
import { DISCHARGED_STATUSES } from "@/lib/clients/list";
import type { ClientProfileData } from "./use-client-profile";
import { HeaderMenu } from "./header-menu";

const CHIP = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
const MUTED = "border-border bg-muted text-muted-foreground";

export function isDischarged(status: string | null | undefined): boolean {
  return (DISCHARGED_STATUSES as readonly string[]).includes(status ?? "");
}

function planYear(plan: ClientProfileData["plan"]): string | null {
  if (!plan) return null;
  if (plan.start_date && plan.end_date) {
    const o = { month: "short", year: "numeric" } as const;
    return `Plan year ${formatDate(plan.start_date, o)} – ${formatDate(plan.end_date, o)}`;
  }
  return plan.label ? `Plan year ${plan.label}` : null;
}

export function ClientProfileHeader({
  orgId,
  data,
  onChanged,
}: {
  orgId: string;
  data: ClientProfileData;
  onChanged: () => void;
}) {
  const { client } = data;
  const discharged = isDischarged(client.account_status);
  const medicaid = displayMedicaidId(client.medicaid_id);
  const parts = [
    data.home?.name ?? null,
    planYear(data.plan),
    data.supportCoordinator ? `SC ${data.supportCoordinator}` : null,
    medicaid ? `Medicaid ${medicaid}` : null,
  ].filter((p): p is string => !!p);

  return (
    <div className="space-y-3" data-testid="client-profile-header">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard/clients" data-testid="client-profile-back">
          <ArrowLeft className="mr-1 h-4 w-4" /> Clients
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PersonAvatar
            bucket="client-photos"
            path={client.client_photo_url}
            name={data.name}
            className="h-14 w-14 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-xl font-semibold leading-tight"
                data-testid="client-profile-heading"
              >
                {data.name}
              </h1>
              <span
                className={cn(
                  CHIP,
                  discharged
                    ? MUTED
                    : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
                )}
                data-testid="client-profile-status"
              >
                {discharged
                  ? `Discharged${client.discharge_date ? ` ${formatDate(client.discharge_date)}` : ""}`
                  : "Active"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {data.codes.length ? (
                data.codes.map((c) => (
                  <span
                    key={c}
                    className={cn(CHIP, MUTED, "font-mono")}
                    data-testid="client-profile-code"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className={cn(CHIP, "border-amber-300 bg-amber-50 text-amber-800")}>
                  No codes
                </span>
              )}
              {parts.length ? <span>{parts.join(" · ")}</span> : null}
            </div>
          </div>
        </div>
        <HeaderMenu orgId={orgId} data={data} discharged={discharged} onChanged={onChanged} />
      </div>
    </div>
  );
}
