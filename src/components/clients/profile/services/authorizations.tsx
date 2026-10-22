// Services & billing: the header card (Fill from 1056, Add authorization),
// one card per open authorization, then Past authorizations (ended codes
// with Renew, and earlier periods). Authorizations are never deleted.
// ?edit=codes opens Add authorization; ?edit=units opens the first open
// authorization with no yearly units, on its Units field.

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import type { AuthorizationRow as Row } from "@/lib/clients/authorizations";
import { pastPeriods } from "@/lib/clients/authorization-renewal";
import { primaryContact } from "@/lib/clients/contacts";
import { teamOnCode } from "@/lib/clients/team";
import { getUnitAlerts } from "@/lib/clients/unit-alerts.functions";
import { useAllClientContacts } from "@/components/clients/shared/hooks/use-client-contacts";
import { useOrgStaff } from "@/components/clients/shared/hooks/use-org-staff";
import { useClientTeam } from "@/components/clients/profile/team/use-client-team";
import { AuthorizationCard } from "./authorization-card";
import { PastAuthorizationsCard } from "./past-authorizations-card";
import { money } from "./money";
import { AuthorizationDialog } from "./authorization-dialog";
import { EndAuthorizationDialog } from "./end-authorization-dialog";
import { Fill1056Review } from "./fill-1056-review";
import { use1056Import } from "./use-1056-import";
import { useClientServices, useRefreshServices } from "./use-client-services";
import { useEditShortcut } from "../use-edit-shortcut";

type Editing = { row: Row | null; renew: boolean; focusId?: string } | null;

export function Authorizations({
  orgId,
  clientId,
  clientName,
  canEdit,
}: {
  orgId: string;
  clientId: string;
  clientName: string;
  canEdit: boolean;
}) {
  const q = useClientServices(orgId, clientId);
  const qc = useQueryClient();
  const alertsFn = useServerFn(getUnitAlerts);
  const alertsKey = ["client-unit-alerts", clientId] as const;
  const alertsQ = useQuery({
    queryKey: alertsKey,
    queryFn: () => alertsFn({ data: { organizationId: orgId, clientId } }),
  });
  const contactsQ = useAllClientContacts(clientId);
  const coordinatorEmail =
    primaryContact(contactsQ.data ?? [], "support_coordinator")?.email ?? null;
  const teamQ = useClientTeam(orgId, clientId);
  const staffQ = useOrgStaff(orgId);
  const teamLoaded = !!teamQ.data && !!staffQ.data;
  const refresh = useRefreshServices(clientId);
  const imp = use1056Import(orgId, clientId, refresh);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [ending, setEnding] = useState<Row | null>(null);

  const data = q.data;
  const all = data?.authorizations ?? [];
  const open = all.filter((v) => v.state !== "ended");
  const ended = all.filter((v) => v.state === "ended");
  const earlier = pastPeriods(
    all.map((v) => v.row),
    data?.history ?? {},
  );
  // Same rule as the list's "+ Add units" (list-load.ts needsUnits).
  const missingUnits = open.find(
    (v) => !v.row.authorization_pending && !(Number(v.row.annual_unit_authorization) > 0),
  );
  const codesDone = useEditShortcut({
    clientId,
    target: "codes",
    canEdit,
    ready: !!data,
    open: () => setEditing({ row: null, renew: false, focusId: "auth-code" }),
  });
  const unitsDone = useEditShortcut({
    clientId,
    target: "units",
    canEdit,
    ready: !!data,
    open: () => {
      if (missingUnits) {
        setEditing({ row: missingUnits.row, renew: false, focusId: "auth-units" });
        return;
      }
      // Nothing left to fill in: show the card and drop the flag.
      document.getElementById("client-authorizations")?.scrollIntoView({ block: "start" });
      unitsDone();
    },
  });

  const addButton = (
    <Button onClick={() => setEditing({ row: null, renew: false })}>
      <Plus className="h-4 w-4" />
      Add authorization
    </Button>
  );

  return (
    <>
      <SectionCard
        icon={Receipt}
        tone="profile"
        title="Services & billing"
        description="What the state authorized, and how much is used."
        testId="client-authorizations-card"
        id="client-authorizations"
        actions={
          canEdit ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void imp.upload(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                disabled={imp.reading}
                onClick={() => fileRef.current?.click()}
              >
                {imp.reading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {imp.reading ? "Reading the 1056…" : "Fill from 1056"}
              </Button>
              {addButton}
            </>
          ) : null
        }
      >
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : q.error ? (
          <p className="text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Couldn't load authorizations."}
          </p>
        ) : open.length === 0 ? (
          <EmptyState action={canEdit ? addButton : null}>
            No open authorizations. Without one, this client can't be scheduled or billed.
          </EmptyState>
        ) : data && data.totals.authorized > 0 ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            Budget {money(data.totals.authorized)} · used {money(data.totals.used)} ·{" "}
            <strong className="text-hive-ink">{money(data.totals.left)} left</strong>
          </p>
        ) : null}
      </SectionCard>

      {open.map((v) => (
        <AuthorizationCard
          key={v.row.id}
          v={v}
          history={data?.history[v.row.id] ?? []}
          canEdit={canEdit}
          team={
            teamLoaded
              ? teamOnCode(teamQ.data!.assigned, staffQ.data!, v.row.service_code)
              : null
          }
          email={{
            orgId,
            clientId,
            clientName,
            alerts: alertsQ.data ?? [],
            coordinatorEmail,
            onChanged: () => void qc.invalidateQueries({ queryKey: alertsKey }),
          }}
          onEdit={() => setEditing({ row: v.row, renew: false })}
          onEnd={() => setEnding(v.row)}
        />
      ))}

      <PastAuthorizationsCard
        ended={ended}
        earlier={earlier}
        canEdit={canEdit}
        onRenew={(v) => setEditing({ row: v.row, renew: true })}
      />

      {editing ? (
        <AuthorizationDialog
          orgId={orgId}
          clientId={clientId}
          row={editing.row}
          renew={editing.renew}
          agencyCodes={data?.agencyCodes ?? []}
          focusId={editing.focusId}
          onClose={() => {
            setEditing(null);
            codesDone();
            unitsDone();
          }}
          onSaved={refresh}
        />
      ) : null}
      {ending ? (
        <EndAuthorizationDialog
          orgId={orgId}
          clientId={clientId}
          row={ending}
          onClose={() => setEnding(null)}
          onSaved={refresh}
        />
      ) : null}
      {imp.read && imp.review ? (
        <Fill1056Review
          read={imp.read}
          review={imp.review}
          onChange={imp.setReview}
          saving={imp.saving}
          onConfirm={() => void imp.confirm()}
          onClose={imp.close}
        />
      ) : null}
    </>
  );
}
