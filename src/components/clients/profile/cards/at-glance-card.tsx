// Health at a glance (until the Health section is rebuilt): primary
// diagnosis, primary care, PCSP expiration, ABI and DNR flags.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { contactLine, primaryContact } from "@/lib/clients/contacts";
import { daysUntil } from "@/lib/clients/dates";
import { updateClient } from "@/lib/clients/writes.functions";
import { onClientDutyFactsChanged } from "@/lib/staff-assignment-hooks.functions";
import { useClientContacts } from "@/components/clients/shared/hooks/use-client-contacts";
import type { ClientProfileRow } from "@/components/clients/profile/use-client-profile";
import { CardShell, LabeledInput, Row, fmtDate } from "./card-shell";

function baseline(client: ClientProfileRow) {
  return {
    primary_dx: client.diagnoses?.[0] ?? "",
    pcsp_expiration_date: client.pcsp_expiration_date ?? "",
    has_abi: client.has_abi === true,
    dnr_applicable: client.dnr_applicable === true,
  };
}

export function AtGlanceCard({ orgId, client }: { orgId: string; client: ClientProfileRow }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateClient);
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => baseline(client));
  const doctor = primaryContact(useClientContacts(client.id).data ?? [], "primary_doctor");
  const diagnoses = client.diagnoses ?? [];

  const mut = useMutation({
    mutationFn: async () => {
      const dx = draft.primary_dx.trim();
      await updateFn({
        data: {
          organizationId: orgId,
          clientId: client.id,
          patch: {
            diagnoses: dx ? [dx, ...diagnoses.slice(1)] : diagnoses.slice(1),
            pcsp_expiration_date: draft.pcsp_expiration_date || null,
            has_abi: draft.has_abi,
            dnr_applicable: draft.dnr_applicable,
          },
        },
      });
      const before = baseline(client);
      if (
        draft.has_abi !== before.has_abi ||
        draft.pcsp_expiration_date !== before.pcsp_expiration_date
      ) {
        try {
          await dutyFactsFn({ data: { organizationId: orgId, clientId: client.id } });
        } catch (e) {
          console.warn("[obligations] client duty reevaluate failed:", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Saved.");
      qc.invalidateQueries({ queryKey: ["client-profile"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exp = client.pcsp_expiration_date;
  const days = daysUntil(exp);
  const warn = days !== null && days < 30;

  return (
    <CardShell
      title="At a glance"
      editing={editing}
      onEdit={() => {
        setDraft(baseline(client));
        setEditing(true);
      }}
      onSave={() => mut.mutate()}
      onCancel={() => setEditing(false)}
      saving={mut.isPending}
    >
      {!editing ? (
        <>
          <Row label="Primary diagnosis">{diagnoses[0] || null}</Row>
          <Row label="Primary care">{contactLine(doctor) || null}</Row>
          <Row label="PCSP expiration">
            {exp ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  warn && "font-semibold text-red-600",
                )}
              >
                {warn ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                {fmtDate(exp)}
              </span>
            ) : null}
          </Row>
          <Row label="Acquired brain injury (ABI)">
            {client.has_abi ? "Yes — staff should have ABI training" : "No"}
          </Row>
          <Row label="DNR order">{client.dnr_applicable ? "On — document required" : "Off"}</Row>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <LabeledInput
            label="Primary diagnosis"
            value={draft.primary_dx}
            onChange={(v) => setDraft((d) => ({ ...d, primary_dx: v }))}
          />
          <LabeledInput
            label="PCSP expiration"
            type="date"
            value={draft.pcsp_expiration_date}
            onChange={(v) => setDraft((d) => ({ ...d, pcsp_expiration_date: v }))}
          />
          <div className="flex items-center gap-3">
            <Switch
              id="has-abi"
              checked={draft.has_abi}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, has_abi: v }))}
            />
            <Label htmlFor="has-abi" className="text-sm">
              Acquired brain injury (ABI)
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="dnr-app"
              checked={draft.dnr_applicable}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, dnr_applicable: v }))}
            />
            <Label htmlFor="dnr-app" className="text-sm">
              DNR order on file (a DNR document is then required)
            </Label>
          </div>
        </div>
      )}
    </CardShell>
  );
}
