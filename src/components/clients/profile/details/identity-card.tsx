// Identity on the Profile section: date of birth and age, Medicaid ID
// (masked), DSPD PID, own guardian, language, admitted, phone and insurance.
// Name and home are in the header; editing covers them too. Insurance is
// medical info, so changing it needs Client medical: Edit (on the server).

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IdCard } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAccess } from "@/hooks/use-access";
import { ageOn, formatDate } from "@/lib/clients/dates";
import { useClientCareData } from "@/hooks/use-client-care-data";
import { maskId } from "@/lib/clients/profile-header";
import { updateClient } from "@/lib/clients/writes.functions";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid, LabeledInput } from "@/components/clients/profile/cards/card-parts";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

type Draft = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone_number: string;
  medicaid_id: string;
  client_pid: string;
  insurance: string;
  admission_date: string;
  team_id: string;
};

function baseline(data: ClientProfileData): Draft {
  const c = data.client;
  return {
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    date_of_birth: c.date_of_birth ?? "",
    phone_number: c.phone_number ?? "",
    medicaid_id: c.medicaid_id ?? "",
    client_pid: c.client_pid ?? "",
    insurance: c.insurance ?? "",
    admission_date: c.admission_date ?? "",
    team_id: c.team_id ?? "",
  };
}

/** Only the fields that changed, blanks saved as null. */
function patchFrom(draft: Draft, before: Draft): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of Object.keys(draft) as (keyof Draft)[]) {
    const v = draft[k].trim();
    if (v !== before[k].trim()) out[k] = v || null;
  }
  return out;
}

export function IdentityCard({
  orgId,
  data,
  onChanged,
}: {
  orgId: string;
  data: ClientProfileData;
  onChanged: () => void;
}) {
  const c = data.client;
  const canEdit = useAccess().canCategory("clients", "edit");
  const updateFn = useServerFn(updateClient);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => baseline(data));
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const homesQ = useQuery({
    enabled: editing,
    queryKey: ["org-homes", orgId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("teams")
        .select("id, team_name")
        .eq("organization_id", orgId)
        .order("team_name");
      if (error) throw error;
      return rows ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const patch = patchFrom(draft, baseline(data));
      if (!draft.first_name.trim() || !draft.last_name.trim())
        throw new Error("First and last name are required");
      if (Object.keys(patch).length === 0) return;
      await updateFn({ data: { organizationId: orgId, clientId: c.id, patch } });
    },
    onSuccess: () => {
      toast.success("Saved.");
      setEditing(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const age = ageOn(c.date_of_birth);
  const care = useClientCareData(c.id);
  const language =
    care.data?.custom_fields
      .find((f) => f.field_key === "primary_language")
      ?.value?.value_text?.trim() || null;

  return (
    <SectionCard
      icon={IdCard}
      tone="profile"
      title="Identity"
      description="Birthday and the IDs used for billing."
      actions={
        canEdit && !editing ? (
          <EditButton
            label="Edit identity"
            onClick={() => {
              setDraft(baseline(data));
              setEditing(true);
            }}
          />
        ) : null
      }
    >
      {!editing ? (
        <div data-testid="client-identity">
          <FieldGrid>
            <Field label="Date of birth">
              {c.date_of_birth
                ? `${formatDate(c.date_of_birth)}${age != null ? ` · age ${age}` : ""}`
                : null}
            </Field>
            <Field label="Medicaid ID">{maskId(c.medicaid_id)}</Field>
            <Field label="DSPD PID">{c.client_pid || null}</Field>
            <Field label="Own guardian">
              {c.is_own_guardian == null ? null : c.is_own_guardian ? "Yes" : "No"}
            </Field>
            <Field label="Language">{language}</Field>
            <Field label="Admitted">{c.admission_date ? formatDate(c.admission_date) : null}</Field>
            <Field label="Phone">{c.phone_number || null}</Field>
            <Field label="Insurance">{c.insurance || null}</Field>
          </FieldGrid>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledInput label="First name" value={draft.first_name} onChange={set("first_name")} />
          <LabeledInput label="Last name" value={draft.last_name} onChange={set("last_name")} />
          <LabeledInput
            label="Date of birth"
            type="date"
            value={draft.date_of_birth}
            onChange={set("date_of_birth")}
          />
          <LabeledInput label="Phone" value={draft.phone_number} onChange={set("phone_number")} />
          <LabeledInput
            label="Medicaid ID"
            value={draft.medicaid_id}
            onChange={set("medicaid_id")}
          />
          <LabeledInput label="DSPD PID" value={draft.client_pid} onChange={set("client_pid")} />
          <LabeledInput label="Insurance" value={draft.insurance} onChange={set("insurance")} />
          <LabeledInput
            label="Admitted"
            type="date"
            value={draft.admission_date}
            onChange={set("admission_date")}
          />
          <div className="space-y-1 text-sm sm:col-span-2">
            <Label htmlFor="client-home" className="text-xs font-medium text-muted-foreground">
              Home
            </Label>
            <select
              id="client-home"
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={draft.team_id}
              onChange={(e) => set("team_id")(e.target.value)}
            >
              <option value="">No home</option>
              {(homesQ.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.team_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {editing ? (
        <SaveBar
          onCancel={() => setEditing(false)}
          onSave={() => save.mutate()}
          saving={save.isPending}
          saveLabel="Save identity"
        />
      ) : null}
    </SectionCard>
  );
}
