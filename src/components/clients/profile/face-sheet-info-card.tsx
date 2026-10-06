// Face Sheet Info — editable card that backs every Client Face Sheet field
// with a real, admin-editable data source on the `clients` row.
//
// Grouped sections: Identity & IDs, Insurance & Payment, Physical Description,
// Places Frequented, Allergies. All fields optional (intake never blocked).
// Contacts and providers are edited in Contacts (client_contacts); staff
// must-knows in the profile's alert (special_directions).
//
// Reads/writes: public.clients (RLS-scoped to org members via existing policy).

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { onClientDutyFactsChanged } from "@/lib/staff-assignment-hooks.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateClient } from "@/lib/clients/writes.functions";
import { Field, Section } from "./face-sheet-info-fields";

const FIELDS = [
  // Identity & IDs
  "client_pid",
  "place_of_birth",
  "ethnic_origin",
  "religion",
  "state_id_number",
  "state_id_expires_on",
  "pcsp_signed_date",
  "intake_date",
  "medicaid_case_number",
  "medicaid_id",
  "insurance",
  "payment_sources",
  "income_sources",
  // Physical
  "height_inches",
  "weight_pounds",
  "hair_color",
  "eye_color",
  "identifying_marks",
  "places_frequented",
  // Safety / Health
  "allergies",
] as const;


const SELECT_COLS = FIELDS.join(", ");

type Row = Partial<Record<(typeof FIELDS)[number], unknown>>;

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return (v as unknown[]).map(String).join(", ");
  return String(v);
}

function toArr(v: string): string[] | null {
  const items = v.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : null;
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function FaceSheetInfoCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const updateClientFn = useServerFn(updateClient);
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["client-face-sheet-info", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select(SELECT_COLS as any)
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Row;
    },
  });

  useEffect(() => {
    if (!q.data) return;
    const seed: Record<string, string> = {};
    for (const k of FIELDS) seed[k] = toStr((q.data as Row)[k]);
    setForm(seed);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        client_pid: form.client_pid || null,
        place_of_birth: form.place_of_birth || null,
        ethnic_origin: form.ethnic_origin || null,
        religion: form.religion || null,
        state_id_number: form.state_id_number || null,
        state_id_expires_on: form.state_id_expires_on || null,
        pcsp_signed_date: form.pcsp_signed_date || null,
        intake_date: form.intake_date || null,
        medicaid_case_number: form.medicaid_case_number || null,
        medicaid_id: form.medicaid_id || null,
        insurance: form.insurance || null,
        payment_sources: toArr(form.payment_sources ?? ""),
        income_sources: toArr(form.income_sources ?? ""),
        height_inches: toIntOrNull(form.height_inches ?? ""),
        weight_pounds: toIntOrNull(form.weight_pounds ?? ""),
        hair_color: form.hair_color || null,
        eye_color: form.eye_color || null,
        identifying_marks: form.identifying_marks || null,
        places_frequented: form.places_frequented || null,
        allergies: toArr(form.allergies ?? ""),
      };
      if (!org?.organization_id) throw new Error("No organization selected.");
      await updateClientFn({ data: { organizationId: org.organization_id, clientId, patch } });
      const priorSigned = toStr((q.data as Row | undefined)?.pcsp_signed_date);
      if (org?.organization_id && form.pcsp_signed_date !== priorSigned) {
        try {
          await dutyFactsFn({
            data: { organizationId: org.organization_id, clientId },
          });
        } catch (e) {
          console.warn("[obligations] face-sheet PCSP duty reevaluate failed:", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Face sheet info saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client-face-sheet-info", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 border-b border-border/60 px-5 py-4">
          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IdCard className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight">Face Sheet Info</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              All optional — completes the printable Client Face Sheet used for
              emergency and law-enforcement identification.
            </p>
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-6 p-5">
          <Section title="Identity & IDs">
            <Field label="PID #" k="client_pid" form={form} set={set} editing={editing} />
            <Field label="Place of birth" k="place_of_birth" form={form} set={set} editing={editing} />
            <Field label="Ethnic origin" k="ethnic_origin" form={form} set={set} editing={editing} />
            <Field label="Religion" k="religion" form={form} set={set} editing={editing} />
            <Field label="Utah ID #" k="state_id_number" form={form} set={set} editing={editing} />
            <Field label="Utah ID expiration" k="state_id_expires_on" type="date" form={form} set={set} editing={editing} />
            <Field label="PCSP signed date" k="pcsp_signed_date" type="date" form={form} set={set} editing={editing} />
            <Field label="Intake date" k="intake_date" type="date" form={form} set={set} editing={editing} />
          </Section>

          <Section title="Insurance & Payment">
            <Field label="Medicaid case #" k="medicaid_case_number" form={form} set={set} editing={editing} />
            <Field label="Medicaid #" k="medicaid_id" form={form} set={set} editing={editing} />
            <Field label="Insurance (Medicare, private plans)" k="insurance" multiline form={form} set={set} editing={editing} full />
            <Field label="Payment sources (comma-separated)" k="payment_sources" form={form} set={set} editing={editing} />
            <Field label="Income sources (comma-separated)" k="income_sources" form={form} set={set} editing={editing} />
          </Section>

          <Section title="Physical description">
            <Field label="Height (inches)" k="height_inches" type="number" form={form} set={set} editing={editing} />
            <Field label="Weight (lbs)" k="weight_pounds" type="number" form={form} set={set} editing={editing} />
            <Field label="Hair color" k="hair_color" form={form} set={set} editing={editing} />
            <Field label="Eye color" k="eye_color" form={form} set={set} editing={editing} />
            <Field label="Identifying marks / scars / tattoos" k="identifying_marks" multiline form={form} set={set} editing={editing} full />
            <Field label="Places frequented / known locations" k="places_frequented" multiline form={form} set={set} editing={editing} full />
          </Section>

          <Section title="Health & Safety">
            <Field label="Allergies (comma-separated)" k="allergies" form={form} set={set} editing={editing} full />
          </Section>

          {editing && (
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
