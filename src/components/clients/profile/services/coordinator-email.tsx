// Under the "At this pace the units run out …" warning: Email coordinator
// (a mailto: link — PI sends nothing), then "I sent it" records who and
// when, shown as "✓ Coordinator emailed by …, <date>" with Undo. No
// coordinator email → a link to Contacts. Only Owners and Admins with Billing
// edit get the button, the checkbox and Undo; everyone else sees the record.
// The rule is lib/clients/services/unit-alerts.ts.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccess } from "@/hooks/use-access";
import type { AuthorizationView } from "@/lib/clients/services/authorizations";
import {
  canRecordUnitAlert,
  coordinatorMailto,
  unitAlertLine,
  unitAlertState,
  type UnitAlert,
} from "@/lib/clients/services/unit-alerts";
import { recordUnitAlert, voidUnitAlert } from "@/lib/clients/services/unit-alerts.functions";

export function CoordinatorEmail({
  orgId,
  clientId,
  clientName,
  v,
  alerts,
  coordinatorEmail,
  canEdit,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  clientName: string;
  v: AuthorizationView;
  alerts: readonly UnitAlert[];
  coordinatorEmail: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [clicked, setClicked] = useState(false);
  const canRecord = canRecordUnitAlert(useAccess().level, canEdit);
  const recordFn = useServerFn(recordUnitAlert);
  const voidFn = useServerFn(voidUnitAlert);
  const record = useMutation({
    mutationFn: () =>
      recordFn({ data: { organizationId: orgId, clientId, billingCodeId: v.row.id } }),
    onSuccess: () => {
      setClicked(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const undo = useMutation({
    mutationFn: (alertId: string) => voidFn({ data: { organizationId: orgId, clientId, alertId } }),
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  const state = unitAlertState({
    warning: v.state === "current" && !!v.runsOutOn,
    billingCodeId: v.row.id,
    alerts,
    coordinatorEmail,
    clicked,
    canEdit: canRecord,
  });
  if (state.kind === "hidden") return null;

  if (state.kind === "recorded") {
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        data-testid="unit-alert-recorded"
      >
        <span>{unitAlertLine(state.alert)}</span>
        {canRecord ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={undo.isPending}
            onClick={() => undo.mutate(state.alert.id)}
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
        ) : null}
      </div>
    );
  }

  if (state.kind === "add_email") {
    return (
      <Link
        to="/dashboard/clients/$clientId"
        params={{ clientId }}
        search={{ section: "contacts" }}
        className="inline-flex min-h-8 items-center text-xs font-medium text-[var(--hive-info-fg)] hover:underline max-md:min-h-11"
        data-testid="unit-alert-add-email"
      >
        Add the coordinator's email in Contacts
      </Link>
    );
  }

  if (state.kind === "confirm") {
    const id = `unit-alert-sent-${v.row.id}`;
    return (
      <label
        htmlFor={id}
        className="inline-flex min-h-8 items-center gap-2 text-xs max-md:min-h-11"
        data-testid="unit-alert-confirm"
      >
        <Checkbox
          id={id}
          checked={record.isPending}
          disabled={record.isPending}
          onCheckedChange={(c) => {
            if (c === true) record.mutate();
          }}
        />
        I sent it
      </label>
    );
  }

  return (
    <Button asChild variant="outline" size="sm" className="max-md:min-h-11">
      <a
        href={coordinatorMailto(state.email, {
          clientName,
          code: v.row.service_code,
          used: v.pace.used,
          total: v.pace.annual,
          unitWord: v.unitWord,
          runsOutOn: v.runsOutOn!,
        })}
        onClick={() => setClicked(true)}
        data-testid="unit-alert-email"
      >
        <Mail className="h-4 w-4" />
        Email coordinator
      </a>
    </Button>
  );
}
