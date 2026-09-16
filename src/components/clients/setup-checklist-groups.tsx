// Grouped checklist rows + shared UI for SetupChecklist.
// Passing flags, queries, and submit stay in setup-checklist.tsx — this file
// is presentation. Row save paths are the same server functions as before.
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  addClientBillingCodes,
  removeClientBillingCode,
  saveOnboardingBillingRate,
  saveOnboardingClientPatch,
  saveProfileField,
} from "@/lib/finish-onboarding.functions";
import {
  setLevelOfNeed,
  setEmergencyContact,
  setGrievanceAcknowledgment,
  appendClientArrayField,
  upsertClientMedication,
  listHrcReviewsForClient,
  createHrcReview,
  setEndOfLifeStatus,
} from "@/lib/import-checklist.functions";
import {
  setFieldConfirmation,
  type FieldStateMap,
} from "@/lib/field-confirmations.functions";
import type { FieldState } from "@/lib/field-confirmations";
import { EVV_SERVICE_CODES } from "@/lib/evv-codes";
import { isClockableServiceCode } from "@/lib/service-billing";
import {
  PROFILE_FIELD_BY_KEY,
  type ProfileField,
} from "@/lib/client-profile-fields";
import { CaseloadEditor } from "@/components/clients/caseload-editor";
import { NectarAsk } from "@/components/clients/nectar-ask";

export type BillingCodeRow = {
  id: string;
  service_code: string | null;
  rate_per_unit: number | null;
  annual_unit_authorization: number | null;
};

export type ClientPcsp = {
  pcsp_goals: string[] | null;
  physical_address: string | null;
  geofence_radius_feet: number | null;
  is_own_guardian: boolean | null;
  guardian_name: string | null;
};

export type SowSupp = {
  level_of_need: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_instructions: string | null;
  grievance_acknowledged: boolean | null;
  grievance_signed_date: string | null;
};

export type RequiredRowPass = {
  code: boolean;
  rates: boolean;
  goals: boolean;
  staff: boolean;
  guardian: boolean;
  evv: boolean;
  sow: boolean;
  lon: boolean;
  ec2: boolean;
  grievance: boolean;
  rights: boolean;
};

export type AskPass = {
  medications: boolean;
  allergies: boolean;
  immunizations: boolean;
  advanced_directives: boolean;
  court_orders: boolean;
};

// ---------------------------------------------------------------------------
// Reusable row primitive — every checklist row uses this.
// ---------------------------------------------------------------------------
export function ChecklistRow({
  passing,
  label,
  valueChip,
  children,
  defaultOpen,
  rightBadge,
}: {
  passing: boolean;
  label: string;
  valueChip?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  rightBadge?: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-colors hover:border-primary/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          {passing ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Circle className="h-4 w-4 text-amber-500 fill-amber-400/30" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {valueChip}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rightBadge ??
            (passing ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mr-1 h-3 w-3" /> done
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                required
              </Badge>
            ))}
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && children ? (
        <div className="border-t border-border/60 px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}

function ChecklistGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function RequiredToGoLiveGroup({
  clientId,
  codes,
  client,
  sowSupp,
  sowMissingKeys,
  evvApplicable,
  rowPass,
  onChanged,
}: {
  clientId: string;
  codes: BillingCodeRow[];
  client: ClientPcsp;
  sowSupp: SowSupp;
  sowMissingKeys: string[];
  evvApplicable: boolean;
  rowPass: RequiredRowPass;
  onChanged: () => void;
}) {
  return (
    <ChecklistGroup title="Required to go live">
      <ClockableCodeRow
        clientId={clientId}
        codes={codes}
        passing={rowPass.code}
        onChanged={onChanged}
      />
      <RatesRow
        codes={codes}
        passing={rowPass.rates}
        onChanged={onChanged}
      />
      <GoalsRow
        clientId={clientId}
        goals={(client.pcsp_goals ?? []) as string[]}
        passing={rowPass.goals}
        onChanged={onChanged}
      />
      <StaffRow
        clientId={clientId}
        passing={rowPass.staff}
        onChanged={onChanged}
      />
      <GuardianRow
        clientId={clientId}
        initial={{
          is_own_guardian: client.is_own_guardian ?? null,
          guardian_name: client.guardian_name ?? "",
        }}
        passing={rowPass.guardian}
        onChanged={onChanged}
      />
      {evvApplicable ? (
        <HomeEvvRow
          clientId={clientId}
          initial={{
            physical_address: client.physical_address ?? "",
            geofence_radius_feet: client.geofence_radius_feet ?? 150,
          }}
          passing={rowPass.evv}
          onChanged={onChanged}
        />
      ) : null}
      <SowFieldsRow
        clientId={clientId}
        missingKeys={sowMissingKeys}
        passing={rowPass.sow}
        onChanged={onChanged}
      />
      <LevelOfNeedRow
        clientId={clientId}
        initial={sowSupp.level_of_need ?? ""}
        passing={rowPass.lon}
        onChanged={onChanged}
      />
      <EmergencyContact2Row
        clientId={clientId}
        initial={{
          name: sowSupp.emergency_contact_2_name ?? "",
          phone: sowSupp.emergency_contact_2_phone ?? "",
          instructions: sowSupp.emergency_contact_2_instructions ?? "",
        }}
        passing={rowPass.ec2}
        onChanged={onChanged}
      />
      <GrievanceRow
        clientId={clientId}
        initial={{
          acknowledged: !!sowSupp.grievance_acknowledged,
          date: sowSupp.grievance_signed_date ?? "",
        }}
        passing={rowPass.grievance}
        onChanged={onChanged}
      />
    </ChecklistGroup>
  );
}

export function NectarAsksGroup({
  clientId,
  fieldStates,
  askPass,
  rightsState,
  rightsPassing,
  onChanged,
}: {
  clientId: string;
  fieldStates: FieldStateMap;
  askPass: AskPass;
  rightsState: FieldState;
  rightsPassing: boolean;
  onChanged: () => void;
}) {
  return (
    <ChecklistGroup title="NECTAR asks">
      <MedicationsAskRow
        clientId={clientId}
        state={fieldStates.medications}
        passing={askPass.medications}
        onChanged={onChanged}
      />
      <AllergiesAskRow
        clientId={clientId}
        state={fieldStates.allergies}
        passing={askPass.allergies}
        onChanged={onChanged}
      />
      <ImmunizationsAskRow
        clientId={clientId}
        state={fieldStates.immunizations}
        passing={askPass.immunizations}
        onChanged={onChanged}
      />
      <AdvancedDirectivesAskRow
        clientId={clientId}
        state={fieldStates.advanced_directives}
        passing={askPass.advanced_directives}
        onChanged={onChanged}
      />
      <CourtOrdersAskRow
        clientId={clientId}
        state={fieldStates.court_orders}
        passing={askPass.court_orders}
        onChanged={onChanged}
      />
      <RightsRestrictionRow
        clientId={clientId}
        state={rightsState}
        passing={rightsPassing}
        onChanged={onChanged}
      />
    </ChecklistGroup>
  );
}

// ---------------------------------------------------------------------------
// Row 1: clockable service code
// ---------------------------------------------------------------------------
function ClockableCodeRow({
  clientId, codes, passing, onChanged,
}: {
  clientId: string;
  codes: BillingCodeRow[];
  passing: boolean;
  onChanged: () => void;
}) {
  const [picked, setPicked] = useState<string>("");
  const addFn = useServerFn(addClientBillingCodes);
  const removeFn = useServerFn(removeClientBillingCode);

  const addM = useMutation({
    mutationFn: (code: string) => addFn({ data: { clientId, codes: [code] } }),
    onSuccess: () => { setPicked(""); toast.success("Service code added."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeM = useMutation({
    mutationFn: (codeId: string) => removeFn({ data: { codeId } }),
    onSuccess: () => { toast.success("Service code removed."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const have = new Set(
    codes.map((c) => String(c.service_code ?? "").toUpperCase()).filter(Boolean),
  );
  const options = EVV_SERVICE_CODES
    .filter((d) => isClockableServiceCode(d.code))
    .filter((d) => !have.has(d.code));

  const valueChip = codes.length > 0 ? (
    <span className="text-xs text-muted-foreground">
      {codes.length} on file
    </span>
  ) : null;

  return (
    <ChecklistRow
      passing={passing}
      label="Clockable service code"
      valueChip={valueChip}
      defaultOpen={!passing}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {codes.length === 0 ? (
            <span className="text-xs text-muted-foreground">No codes on file yet.</span>
          ) : null}
          {codes.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
              {c.service_code}
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                onClick={() => removeM.mutate(c.id)}
                disabled={removeM.isPending}
                aria-label={`Remove ${c.service_code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1 space-y-1">
            <Label className="text-xs">Add a DSPD service code</Label>
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger><SelectValue placeholder="Pick a clockable code…" /></SelectTrigger>
              <SelectContent>
                {options.map((d) => (
                  <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => picked && addM.mutate(picked)}
            disabled={!picked || addM.isPending}
          >
            {addM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add code
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 2: rate & units per code
// ---------------------------------------------------------------------------
function RatesRow({
  codes, passing, onChanged,
}: { codes: BillingCodeRow[]; passing: boolean; onChanged: () => void }) {
  const valueChip = codes.length > 0 ? (
    <span className="text-xs text-muted-foreground">
      {codes.filter((c) => (c.rate_per_unit ?? 0) > 0 && (c.annual_unit_authorization ?? 0) > 0).length}/{codes.length} priced
    </span>
  ) : null;
  return (
    <ChecklistRow
      passing={passing}
      label="Rate & units per code"
      valueChip={valueChip}
      defaultOpen={!passing}
    >
      {codes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a service code above first.</p>
      ) : (
        <div className="space-y-3">
          {codes.map((c) => (
            <RateSubCard key={c.id} row={c} onChanged={onChanged} />
          ))}
        </div>
      )}
    </ChecklistRow>
  );
}

function RateSubCard({ row, onChanged }: { row: BillingCodeRow; onChanged: () => void }) {
  const [rate, setRate] = useState<string>(row.rate_per_unit != null ? String(row.rate_per_unit) : "");
  const [units, setUnits] = useState<string>(row.annual_unit_authorization != null ? String(row.annual_unit_authorization) : "");
  const saveFn = useServerFn(saveOnboardingBillingRate);
  const m = useMutation({
    mutationFn: () => saveFn({ data: { codeId: row.id, rate_per_unit: Number(rate), annual_unit_authorization: Number(units) } }),
    onSuccess: () => { toast.success(`${row.service_code} updated.`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const priced = (row.rate_per_unit ?? 0) > 0 && (row.annual_unit_authorization ?? 0) > 0;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{row.service_code}</div>
        {priced ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">priced</Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700">needs rate & units</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Rate ($/unit)</Label>
          <Input type="number" inputMode="decimal" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Number of units (annual)</Label>
          <Input type="number" inputMode="numeric" step="1" min="0" value={units} onChange={(e) => setUnits(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          onClick={() => m.mutate()}
          disabled={m.isPending || !rate || !units}
        >
          {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row 3: PCSP goals
// ---------------------------------------------------------------------------
function GoalsRow({
  clientId, goals, passing, onChanged,
}: { clientId: string; goals: string[]; passing: boolean; onChanged: () => void }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function write(next: string[]) {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ pcsp_goals: next })
      .eq("id", clientId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  return (
    <ChecklistRow
      passing={passing}
      label="PCSP goals captured"
      valueChip={
        goals.length > 0 ? (
          <span className="text-xs text-muted-foreground">{goals.length} goal{goals.length === 1 ? "" : "s"}</span>
        ) : null
      }
      defaultOpen={!passing}
    >
      <div className="space-y-3">
        <ul className="space-y-1">
          {goals.length === 0 ? (
            <li className="text-xs text-muted-foreground">No goals yet.</li>
          ) : null}
          {goals.map((g, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
              <span className="min-w-0 break-words">{g}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => write(goals.filter((_, j) => j !== i))}
                disabled={saving}
                aria-label="Remove goal"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Add a goal</Label>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Independently prepare lunch 3×/wk" />
          </div>
          <Button
            onClick={async () => {
              const t = draft.trim();
              if (!t) return;
              await write([...goals, t]);
              setDraft("");
            }}
            disabled={saving || !draft.trim()}
          >
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 4: staff assigned
// ---------------------------------------------------------------------------
function StaffRow({
  clientId, passing, onChanged,
}: { clientId: string; passing: boolean; onChanged: () => void }) {
  const qc = useQueryClient();
  return (
    <ChecklistRow
      passing={passing}
      label="Staff assigned"
      defaultOpen={!passing}
    >
      <div
        onBlur={() => {
          // Bubble caseload changes back into readiness without forcing the
          // user to click anything extra.
          qc.invalidateQueries({ queryKey: ["client-readiness", clientId] });
          onChanged();
        }}
      >
        <CaseloadEditor clientId={clientId} />
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 5: guardian
// ---------------------------------------------------------------------------
function GuardianRow({
  clientId, initial, passing, onChanged,
}: {
  clientId: string;
  initial: { is_own_guardian: boolean | null; guardian_name: string };
  passing: boolean;
  onChanged: () => void;
}) {
  const [isOwn, setIsOwn] = useState<boolean>(initial.is_own_guardian ?? true);
  const [name, setName] = useState<string>(initial.guardian_name ?? "");
  const patchFn = useServerFn(saveOnboardingClientPatch);
  const m = useMutation({
    mutationFn: () => patchFn({
      data: {
        clientId,
        patch: {
          is_own_guardian: isOwn,
          guardian_name: isOwn ? null : name.trim(),
        },
      },
    }),
    onSuccess: () => { toast.success("Guardianship saved."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const blocked = !isOwn && !name.trim();
  return (
    <ChecklistRow
      passing={passing}
      label="Guardian confirmed"
      valueChip={
        passing ? (
          <span className="text-xs text-muted-foreground">
            {initial.is_own_guardian ? "Own guardian" : initial.guardian_name}
          </span>
        ) : null
      }
      defaultOpen={!passing}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <div className="text-sm font-medium">Client is their own guardian</div>
            <p className="text-xs text-muted-foreground">Turn off if a separate person legally acts as guardian.</p>
          </div>
          <Switch checked={isOwn} onCheckedChange={setIsOwn} />
        </div>
        {!isOwn ? (
          <div className="space-y-1">
            <Label className="text-xs">Guardian name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full legal name" />
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={() => m.mutate()} disabled={m.isPending || blocked}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 6: home / EVV geocoding (only when an EVV-locked code is on file)
// ---------------------------------------------------------------------------
function HomeEvvRow({
  clientId, initial, passing, onChanged,
}: {
  clientId: string;
  initial: { physical_address: string; geofence_radius_feet: number };
  passing: boolean;
  onChanged: () => void;
}) {
  const [addr, setAddr] = useState(initial.physical_address);
  const [radius, setRadius] = useState<string>(String(initial.geofence_radius_feet ?? 150));
  const patchFn = useServerFn(saveOnboardingClientPatch);
  const m = useMutation({
    mutationFn: () => patchFn({
      data: {
        clientId,
        patch: {
          physical_address: addr.trim(),
          geofence_radius_feet: Number(radius) || 150,
        },
      },
    }),
    onSuccess: () => { toast.success("Home location saved."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ChecklistRow
      passing={passing}
      label="Home geocoded for EVV"
      valueChip={
        passing ? (
          <span className="text-xs text-muted-foreground">Geocoded ✓</span>
        ) : null
      }
      defaultOpen={!passing}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Physical address</Label>
          <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="123 Main St, City, ST 84000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Geofence radius (feet)</Label>
          <Input type="number" inputMode="numeric" min="50" step="10" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => m.mutate()} disabled={m.isPending || !addr.trim()}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save home location
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 7: missing SOW-required profile fields
// ---------------------------------------------------------------------------
function SowFieldsRow({
  clientId, missingKeys, passing, onChanged,
}: { clientId: string; missingKeys: string[]; passing: boolean; onChanged: () => void }) {
  return (
    <ChecklistRow
      passing={passing}
      label="Missing required Scope of Work fields"
      valueChip={
        passing ? (
          <span className="text-xs text-muted-foreground">All required filled</span>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {missingKeys.length} missing
          </span>
        )
      }
      defaultOpen={!passing}
    >
      {missingKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing missing — every SOW-required field has a value.</p>
      ) : (
        <div className="space-y-3">
          {missingKeys.map((key) => {
            const f = PROFILE_FIELD_BY_KEY[key];
            if (!f) return null;
            return <SowFieldInput key={key} clientId={clientId} field={f} onSaved={onChanged} />;
          })}
        </div>
      )}
    </ChecklistRow>
  );
}

function SowFieldInput({
  clientId, field, onSaved,
}: { clientId: string; field: ProfileField; onSaved: () => void }) {
  const [textVal, setTextVal] = useState<string>("");
  const [boolVal, setBoolVal] = useState<boolean>(false);
  const saveFn = useServerFn(saveProfileField);

  function buildPayload(): string | boolean | string[] | null {
    if (field.type === "bool") return boolVal;
    if (field.type === "array") {
      return textVal.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
    }
    return textVal.trim() || null;
  }

  const m = useMutation({
    mutationFn: () => saveFn({ data: { clientId, fieldKey: field.key, value: buildPayload() } }),
    onSuccess: () => { toast.success(`${field.label} saved.`); setTextVal(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const blocked =
    field.type === "bool"
      ? false
      : field.type === "array"
        ? buildPayload() instanceof Array && (buildPayload() as string[]).length === 0
        : !textVal.trim();

  return (
    <div className="rounded-lg border border-border p-3">
      <Label className="text-xs">{field.label}</Label>
      {field.type === "textarea" ? (
        <Textarea
          className="mt-1"
          rows={3}
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
        />
      ) : field.type === "bool" ? (
        <div className="mt-2 flex items-center gap-3">
          <Switch checked={boolVal} onCheckedChange={setBoolVal} />
          <span className="text-sm">{boolVal ? "Yes" : "No"}</span>
        </div>
      ) : field.type === "date" ? (
        <Input className="mt-1" type="date" value={textVal} onChange={(e) => setTextVal(e.target.value)} />
      ) : field.type === "array" ? (
        <Input
          className="mt-1"
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          placeholder="Comma-separated"
        />
      ) : (
        <Input className="mt-1" value={textVal} onChange={(e) => setTextVal(e.target.value)} />
      )}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || blocked}>
          {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row 8: level of need
// ---------------------------------------------------------------------------
function LevelOfNeedRow({
  clientId, initial, passing, onChanged,
}: { clientId: string; initial: string; passing: boolean; onChanged: () => void }) {
  const [val, setVal] = useState(initial);
  const saveFn = useServerFn(setLevelOfNeed);
  const m = useMutation({
    mutationFn: () => saveFn({ data: { clientId, value: val.trim() || null } }),
    onSuccess: () => { toast.success("Level of need saved."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ChecklistRow
      passing={passing}
      label="Level of need"
      valueChip={passing ? <span className="text-xs text-muted-foreground">{initial}</span> : null}
      defaultOpen={!passing}
    >
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Level of need (DSPD-assigned)</Label>
          <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. Level 5" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !val.trim()}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 9: second emergency contact
// ---------------------------------------------------------------------------
function EmergencyContact2Row({
  clientId, initial, passing, onChanged,
}: {
  clientId: string;
  initial: { name: string; phone: string; instructions: string };
  passing: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [instr, setInstr] = useState(initial.instructions);
  const saveFn = useServerFn(setEmergencyContact);
  const m = useMutation({
    mutationFn: () => saveFn({ data: { clientId, slot: "secondary", name, phone, instructions: instr } }),
    onSuccess: () => { toast.success("Secondary emergency contact saved."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ChecklistRow
      passing={passing}
      label="Second emergency contact"
      valueChip={
        passing ? (
          <span className="text-xs text-muted-foreground">{initial.name}</span>
        ) : null
      }
      defaultOpen={!passing}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Instructions on how to reach them</Label>
          <Textarea
            rows={2}
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            placeholder="Best times to call, voicemail OK, backup number, etc."
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !name.trim()}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Row 10: grievance policy acknowledgment
// ---------------------------------------------------------------------------
function GrievanceRow({
  clientId, initial, passing, onChanged,
}: {
  clientId: string;
  initial: { acknowledged: boolean; date: string };
  passing: boolean;
  onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [acked, setAcked] = useState(initial.acknowledged);
  const [date, setDate] = useState(initial.date || today);
  const saveFn = useServerFn(setGrievanceAcknowledgment);
  const m = useMutation({
    mutationFn: () => saveFn({ data: { clientId, acknowledged: acked, signedDate: date } }),
    onSuccess: () => { toast.success("Grievance acknowledgment saved."); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ChecklistRow
      passing={passing}
      label="Grievance policy acknowledged"
      valueChip={
        passing ? (
          <span className="text-xs text-muted-foreground">Signed {initial.date || "today"}</span>
        ) : null
      }
      defaultOpen={!passing}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <div className="text-sm font-medium">Client / representative acknowledged the grievance policy</div>
            <p className="text-xs text-muted-foreground">
              Toggle on once they&apos;ve received and acknowledged it.
            </p>
          </div>
          <Switch checked={acked} onCheckedChange={setAcked} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date signed / acknowledged</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !acked}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </ChecklistRow>
  );
}

function useNoneHandler(clientId: string, key: string, onChanged: () => void) {
  const fn = useServerFn(setFieldConfirmation);
  return async () => {
    await fn({ data: { clientId, key, value: "none" } });
    toast.success("Saved — none on file.");
    onChanged();
  };
}

function answeredSummaryFor(state: FieldState, hasLabel: string, noneLabel: string): string | null {
  if (state === "has") return hasLabel;
  if (state === "none") return noneLabel;
  return null;
}

// ── Medications ───────────────────────────────────────────────────────────
type MedRow = {
  id: string;
  medication_name: string;
  dosage: string | null;
  am_pm: string | null;
  scheduled_time: string | null;
  prescriber: string | null;
  support_level: string | null;
  support_explanation: string | null;
};

function MedicationsAskRow({
  clientId, state, passing, onChanged,
}: { clientId: string; state: FieldState; passing: boolean; onChanged: () => void }) {
  const medsQ = useQuery({
    queryKey: ["client-medications", clientId],
    queryFn: async (): Promise<MedRow[]> => {
      const { data, error } = await supabase
        .from("client_medications")
        .select("id, medication_name, dosage, am_pm, scheduled_time, prescriber, support_level, support_explanation")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as MedRow[];
    },
  });
  const onNone = useNoneHandler(clientId, "medications", onChanged);
  const meds = medsQ.data ?? [];

  const summary = answeredSummaryFor(
    state,
    meds.length > 0 ? `${meds.length} medication${meds.length === 1 ? "" : "s"} on file` : "On file",
    "No medications.",
  );

  return (
    <ChecklistRow
      passing={passing}
      label="Medications"
      valueChip={summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
      defaultOpen={!passing}
    >
      <NectarAsk
        question="Does this client take any medications?"
        finding={state === "unknown" ? "No medications were found in the uploaded documents." : null}
        kind="data_rich_gap"
        clientId={clientId}
        uploadDocumentType="mar"
        onNone={onNone}
        answeredSummary={summary}
        manualForm={
          <MedicationsEditor
            clientId={clientId}
            meds={meds}
            onChanged={onChanged}
          />
        }
      />
    </ChecklistRow>
  );
}

function blankMed(): Omit<MedRow, "id"> & { id?: string } {
  return {
    medication_name: "", dosage: "", am_pm: "", scheduled_time: "",
    prescriber: "", support_level: "", support_explanation: "",
  };
}

function MedicationsEditor({
  clientId, meds, onChanged,
}: { clientId: string; meds: MedRow[]; onChanged: () => void }) {
  const [drafts, setDrafts] = useState<Array<Partial<MedRow> & { _key: string }>>(
    meds.length === 0
      ? [{ ...blankMed(), _key: "new-0" }]
      : meds.map((m) => ({ ...m, _key: m.id })),
  );
  const saveFn = useServerFn(upsertClientMedication);

  const updateAt = (i: number, patch: Partial<MedRow>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const saveOne = async (i: number) => {
    const d = drafts[i];
    if (!d.medication_name?.trim()) {
      toast.error("Medication name is required.");
      return;
    }
    if (!d.support_explanation?.trim()) {
      toast.error("Support explanation is required.");
      return;
    }
    try {
      const res = await saveFn({
        data: {
          clientId,
          medicationId: d.id,
          medication_name: d.medication_name.trim(),
          dosage: d.dosage || null,
          am_pm: d.am_pm || null,
          scheduled_time: d.scheduled_time || null,
          prescriber: d.prescriber || null,
          support_level: d.support_level || null,
          support_explanation: d.support_explanation.trim(),
        },
      });
      toast.success(`Saved ${d.medication_name}.`);
      updateAt(i, { id: res?.id ?? undefined });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      {drafts.map((d, i) => (
        <div key={d._key} className="rounded-lg border border-border p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Medication name</Label>
              <Input value={d.medication_name ?? ""} onChange={(e) => updateAt(i, { medication_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dose</Label>
              <Input value={d.dosage ?? ""} onChange={(e) => updateAt(i, { dosage: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">AM / PM</Label>
              <Select value={d.am_pm ?? ""} onValueChange={(v) => updateAt(i, { am_pm: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                  <SelectItem value="AM & PM">AM & PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scheduled time</Label>
              <Input value={d.scheduled_time ?? ""} onChange={(e) => updateAt(i, { scheduled_time: e.target.value })} placeholder="e.g. 8:00, 20:00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prescribing doctor</Label>
              <Input value={d.prescriber ?? ""} onChange={(e) => updateAt(i, { prescriber: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Level of support</Label>
              <Select value={d.support_level ?? ""} onValueChange={(v) => updateAt(i, { support_level: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Self-administers">Self-administers</SelectItem>
                  <SelectItem value="Self-administers with reminders">Self-administers with reminders</SelectItem>
                  <SelectItem value="Staff assists">Staff assists</SelectItem>
                  <SelectItem value="Staff administers">Staff administers</SelectItem>
                  <SelectItem value="Nurse-delegated">Nurse-delegated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Support explanation</Label>
            <Textarea rows={2} value={d.support_explanation ?? ""} onChange={(e) => updateAt(i, { support_explanation: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => saveOne(i)}>
              {d.id ? "Update" : "Save"} medication
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDrafts((p) => [...p, { ...blankMed(), _key: `new-${Date.now()}` }])}
      >
        <Plus className="mr-1 h-3 w-3" /> Add another medication
      </Button>
    </div>
  );
}

// ── Allergies ─────────────────────────────────────────────────────────────
function AllergiesAskRow({
  clientId, state, passing, onChanged,
}: { clientId: string; state: FieldState; passing: boolean; onChanged: () => void }) {
  const onNone = useNoneHandler(clientId, "allergies", onChanged);
  const summary = answeredSummaryFor(state, "Allergies on file", "No known allergies.");
  return (
    <ChecklistRow
      passing={passing}
      label="Allergies"
      valueChip={summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
      defaultOpen={!passing}
    >
      <NectarAsk
        question="Does this client have any known allergies?"
        finding={state === "unknown" ? "No allergies were found." : null}
        kind="data_rich_gap"
        clientId={clientId}
        uploadDocumentType="allergies"
        onNone={onNone}
        answeredSummary={summary}
        manualForm={<RepeatableAppender clientId={clientId} field="allergies" labelA="Allergen" labelB="Reaction" onChanged={onChanged} />}
      />
    </ChecklistRow>
  );
}

// ── Immunizations ─────────────────────────────────────────────────────────
function ImmunizationsAskRow({
  clientId, state, passing, onChanged,
}: { clientId: string; state: FieldState; passing: boolean; onChanged: () => void }) {
  const onNone = useNoneHandler(clientId, "immunizations", onChanged);
  const summary = answeredSummaryFor(state, "Records on file", "No immunization records on file.");
  return (
    <ChecklistRow
      passing={passing}
      label="Immunizations"
      valueChip={summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
      defaultOpen={!passing}
    >
      <NectarAsk
        question="Are immunization records on file?"
        finding={state === "unknown" ? "No immunization records were found." : null}
        kind="data_rich_gap"
        clientId={clientId}
        uploadDocumentType="immunizations"
        onNone={onNone}
        answeredSummary={summary}
        manualForm={<RepeatableAppender clientId={clientId} field="immunizations" labelA="Vaccine" labelB="Date given" typeB="date" onChanged={onChanged} />}
      />
    </ChecklistRow>
  );
}

function RepeatableAppender({
  clientId, field, labelA, labelB, typeB, onChanged,
}: {
  clientId: string;
  field: "allergies" | "immunizations";
  labelA: string;
  labelB: string;
  typeB?: "text" | "date";
  onChanged: () => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const fn = useServerFn(appendClientArrayField);
  const save = async () => {
    if (!a.trim()) { toast.error(`${labelA} is required.`); return; }
    try {
      await fn({ data: { clientId, field, value: `${a.trim()}${b.trim() ? ` — ${b.trim()}` : ""}` } });
      toast.success("Added.");
      setA(""); setB("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{labelA}</Label>
          <Input value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{labelB}</Label>
          <Input type={typeB ?? "text"} value={b} onChange={(e) => setB(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!a.trim()}>
          <Plus className="mr-1 h-3 w-3" /> Add entry
        </Button>
      </div>
    </div>
  );
}

// ── Advanced directives ───────────────────────────────────────────────────
function AdvancedDirectivesAskRow({
  clientId, state, passing, onChanged,
}: { clientId: string; state: FieldState; passing: boolean; onChanged: () => void }) {
  const fn = useServerFn(setFieldConfirmation);
  const summary = answeredSummaryFor(state, "Directives on file", "No advanced directives on file.");
  const onYes = async () => {
    await fn({ data: { clientId, key: "advanced_directives", value: "has" } });
    toast.success("Saved.");
    onChanged();
  };
  const onNone = useNoneHandler(clientId, "advanced_directives", onChanged);
  return (
    <ChecklistRow
      passing={passing}
      label="Advanced directives"
      valueChip={summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
      defaultOpen={!passing}
    >
      <NectarAsk
        question="Are there advanced directives on file for this client?"
        kind="simple_yes_no"
        onYes={onYes}
        onNone={onNone}
        answeredSummary={summary}
      />
    </ChecklistRow>
  );
}

// ── Court orders ──────────────────────────────────────────────────────────
function CourtOrdersAskRow({
  clientId, state, passing, onChanged,
}: { clientId: string; state: FieldState; passing: boolean; onChanged: () => void }) {
  const onNone = useNoneHandler(clientId, "court_orders", onChanged);
  const summary = answeredSummaryFor(state, "Court orders on file", "No court orders.");
  return (
    <ChecklistRow
      passing={passing}
      label="Court orders"
      valueChip={summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
      defaultOpen={!passing}
    >
      <NectarAsk
        question="Are there any court orders for this client?"
        kind="data_rich_gap"
        clientId={clientId}
        uploadDocumentType="court_order"
        onNone={onNone}
        answeredSummary={summary}
      />
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Rights restrictions → HRC chain (SOW §1.20)
// ---------------------------------------------------------------------------
function RightsRestrictionRow({
  clientId, state, passing, onChanged,
}: { clientId: string; state: FieldState; passing: boolean; onChanged: () => void }) {
  const setConfFn = useServerFn(setFieldConfirmation);
  const listFn = useServerFn(listHrcReviewsForClient);
  const createFn = useServerFn(createHrcReview);

  const reviewsQ = useQuery({
    queryKey: ["hrc-reviews-for-client", clientId],
    queryFn: async () => {
      const r = await listFn({ data: { clientId } });
      return (r.reviews ?? []) as Array<{ id: string; status: string; restriction_summary: string | null }>;
    },
    enabled: state === "has",
  });

  const approvalsQ = useQuery({
    queryKey: ["hrc-approvals-for-client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, file_name")
        .eq("client_id", clientId)
        .eq("document_type", "hrc_approval");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: state === "has",
  });

  const [summary, setSummary] = useState("");
  const createM = useMutation({
    mutationFn: () => createFn({ data: { clientId, restriction_summary: summary, status: "pending" } }),
    onSuccess: () => {
      toast.success("HRC review created (pending).");
      setSummary("");
      reviewsQ.refetch();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setNone = async () => {
    await setConfFn({ data: { clientId, key: "rights_restrictions", value: "none" } });
    toast.success("Recorded — no rights restrictions.");
    onChanged();
  };
  const setYes = async () => {
    await setConfFn({ data: { clientId, key: "rights_restrictions", value: "has" } });
    onChanged();
  };

  const reviews = reviewsQ.data ?? [];
  const approvals = approvalsQ.data ?? [];
  const hasArtifacts = reviews.length > 0 || approvals.length > 0;

  const summaryText =
    state === "none" ? "No rights restrictions."
    : state === "has"
      ? hasArtifacts
        ? `${reviews.length} HRC review${reviews.length === 1 ? "" : "s"}${approvals.length ? `, ${approvals.length} approval doc${approvals.length === 1 ? "" : "s"}` : ""}`
        : "Yes — HRC artifacts needed"
      : null;

  return (
    <ChecklistRow
      passing={passing}
      label="Rights restrictions / HRC"
      valueChip={summaryText ? <span className="text-xs text-muted-foreground">{summaryText}</span> : null}
      defaultOpen={!passing || (state === "has" && !hasArtifacts)}
    >
      {state === "unknown" && (
        <NectarAsk
          question="Are any of this client's rights restricted?"
          kind="simple_yes_no"
          onYes={setYes}
          onNone={setNone}
        />
      )}
      {state === "none" && (
        <div className="flex items-center justify-between rounded-md border border-emerald-300/60 bg-emerald-50/30 p-3 text-sm dark:bg-emerald-950/10">
          <span>No rights restrictions on file.</span>
          <Button size="sm" variant="ghost" onClick={setYes}>Change to Yes</Button>
        </div>
      )}
      {state === "has" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            DSPD §1.20: every restriction requires an HRC review + documented informed consent.
            Link an existing review, create a new one, or upload the signed approval.
          </div>
          {reviews.length > 0 && (
            <div className="space-y-1 rounded border border-border bg-background p-2">
              <div className="text-xs font-semibold">Existing HRC reviews</div>
              {reviews.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.restriction_summary ?? "(no summary)"}</span>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Create new HRC review</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summarize the restriction(s)"
              rows={2}
            />
            <Button size="sm" onClick={() => createM.mutate()} disabled={createM.isPending || !summary.trim()}>
              {createM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create HRC review (pending)
            </Button>
          </div>
          <NectarAsk
            question="Upload signed HRC approval"
            kind="data_rich_gap"
            clientId={clientId}
            uploadDocumentType="hrc_approval"
            onNone={setNone}
          />
          <div className="text-right">
            <Button size="sm" variant="ghost" onClick={setNone}>
              No restrictions after all
            </Button>
          </div>
        </div>
      )}
    </ChecklistRow>
  );
}

// ---------------------------------------------------------------------------
// Optional group — Advanced care / end-of-life (never blocks submit)
// ---------------------------------------------------------------------------
type EolField = "dnr_status" | "polst_status" | "palliative_care_status" | "hospice_status";
const EOL_QUESTIONS: Array<{ field: EolField; question: string; positive: string; uploadType: string; needsLocation?: boolean }> = [
  { field: "dnr_status", question: "Does this client have a DNR on file?", positive: "DNR on file", uploadType: "dnr", needsLocation: true },
  { field: "polst_status", question: "Does this client have a POLST on file?", positive: "POLST on file", uploadType: "polst" },
  { field: "palliative_care_status", question: "Does this client have palliative-care orders on file?", positive: "Palliative-care orders on file", uploadType: "palliative" },
  { field: "hospice_status", question: "Does this client have hospice protocols on file?", positive: "Hospice protocols on file", uploadType: "hospice" },
];

export function EndOfLifeGroup({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["client-eol", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("dnr_status, dnr_location, polst_status, palliative_care_status, hospice_status, special_directions")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      const { data: docs } = await supabase
        .from("client_documents")
        .select("document_type")
        .eq("client_id", clientId)
        .in("document_type", ["dnr", "polst", "palliative", "hospice"]);
      return {
        row: (data ?? {}) as Record<string, string | null>,
        nectarDetected: (docs ?? []).length > 0,
      };
    },
  });

  const detected = useMemo(() => {
    const row = q.data?.row ?? {};
    const anyStatus = ["dnr_status", "polst_status", "palliative_care_status", "hospice_status"]
      .some((k) => !!(row[k] && row[k] !== "none"));
    const specials = String(row.special_directions ?? "").toLowerCase();
    const kw = ["hospice", "palliative", "comfort care", "polst", "dnr"]
      .some((k) => specials.includes(k));
    return anyStatus || kw || !!q.data?.nectarDetected;
  }, [q.data]);

  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? detected;

  const setFn = useServerFn(setEndOfLifeStatus);
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-eol", clientId] });

  return (
    <div>
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Advanced care / end-of-life
      </div>
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <button
          type="button"
          onClick={() => setOpenOverride(open ? false : true)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <div>
            <div className="text-sm font-medium">Advanced care / end-of-life</div>
            <div className="text-xs text-muted-foreground">
              Optional — does not block submission.
              {detected && (
                <span className="ml-1 text-primary">
                  NECTAR detected end-of-life signals — please confirm.
                </span>
              )}
            </div>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {open && (
          <div className="space-y-3 border-t border-border/60 px-4 py-4">
            {EOL_QUESTIONS.map((row) => {
              const current = (q.data?.row?.[row.field] as string | null) ?? null;
              const answered = current ? (current === "none" ? "Not on file" : row.positive) : null;
              return (
                <NectarAsk
                  key={row.field}
                  question={row.question}
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType={row.uploadType}
                  answeredSummary={answered}
                  onNone={async () => {
                    await setFn({ data: { clientId, field: row.field, status: "none" } });
                    refresh();
                  }}
                  manualForm={
                    row.needsLocation ? (
                      <DnrStatusForm
                        clientId={clientId}
                        initialLocation={(q.data?.row?.dnr_location as string | null) ?? ""}
                        onSaved={refresh}
                      />
                    ) : (
                      <EolStatusForm
                        clientId={clientId}
                        field={row.field}
                        onSaved={refresh}
                      />
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EolStatusForm({
  clientId, field, onSaved,
}: { clientId: string; field: EolField; onSaved: () => void }) {
  const setFn = useServerFn(setEndOfLifeStatus);
  const m = useMutation({
    mutationFn: () => setFn({ data: { clientId, field, status: "on_file" } }),
    onSuccess: () => { toast.success("Saved — on file."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
        {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Confirm on file
      </Button>
    </div>
  );
}

function DnrStatusForm({
  clientId, initialLocation, onSaved,
}: { clientId: string; initialLocation: string; onSaved: () => void }) {
  const [loc, setLoc] = useState(initialLocation);
  const setFn = useServerFn(setEndOfLifeStatus);
  const m = useMutation({
    mutationFn: () => setFn({ data: { clientId, field: "dnr_status", status: "on_file", location: loc.trim() } }),
    onSuccess: () => { toast.success("DNR location saved."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-2">
      <Label className="text-xs">Where is the DNR kept?</Label>
      <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. front of binder, fridge magnet…" />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !loc.trim()}>
          {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save DNR location
        </Button>
      </div>
    </div>
  );
}
