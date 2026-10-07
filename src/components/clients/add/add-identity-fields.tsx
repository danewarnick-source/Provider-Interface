import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GEOFENCE_OPTIONS, type AddClientForm, type FilledField } from "@/lib/clients/create";

const NO_HOME = "__none__";

export function FromPcspTag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      From PCSP
    </span>
  );
}

export function Field({
  label,
  children,
  tag,
}: {
  label: string;
  children: React.ReactNode;
  tag?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold">
        {label}
        <FromPcspTag show={!!tag} />
      </span>
      {children}
    </label>
  );
}

export function AddIdentityFields({
  form,
  set,
  filled,
  homes,
  duplicate,
  onMedicaidBlur,
}: {
  form: AddClientForm;
  set: (patch: Partial<AddClientForm>) => void;
  filled: FilledField[];
  homes: { id: string; name: string }[];
  duplicate: { id: string; name: string } | null;
  onMedicaidBlur: () => void;
}) {
  const has = (f: FilledField) => filled.includes(f);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name *" tag={has("name")}>
          <Input
            value={form.first_name}
            onChange={(e) => set({ first_name: e.target.value })}
            maxLength={100}
          />
        </Field>
        <Field label="Last name *" tag={has("name")}>
          <Input
            value={form.last_name}
            onChange={(e) => set({ last_name: e.target.value })}
            maxLength={100}
          />
        </Field>
        <Field label="Date of birth" tag={has("date_of_birth")}>
          <Input
            type="date"
            value={form.date_of_birth ?? ""}
            onChange={(e) => set({ date_of_birth: e.target.value || null })}
          />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={form.start_date ?? ""}
            onChange={(e) => set({ start_date: e.target.value || null })}
          />
        </Field>
        <Field label="Phone" tag={has("phone")}>
          <Input
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            maxLength={50}
          />
        </Field>
        <Field label="Medicaid ID *">
          <Input
            value={form.medicaid_id}
            onChange={(e) => set({ medicaid_id: e.target.value })}
            onBlur={onMedicaidBlur}
            maxLength={50}
            className="font-mono"
            aria-invalid={!!duplicate}
          />
        </Field>
        <Field label="DSPD PID" tag={has("client_pid")}>
          <Input
            value={form.client_pid}
            onChange={(e) => set({ client_pid: e.target.value })}
            maxLength={50}
            className="font-mono"
          />
        </Field>
      </div>
      {duplicate && (
        <p
          className="flex items-center gap-1.5 rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
          role="alert"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This Medicaid ID is already used by{" "}
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId: duplicate.id }}
            search={{}}
            className="font-semibold underline"
          >
            {duplicate.name}
          </Link>
          .
        </p>
      )}
      <Field label="Service address *" tag={has("address")}>
        <Input
          value={form.address}
          onChange={(e) => set({ address: e.target.value })}
          maxLength={255}
          placeholder="Street, City, ST ZIP"
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Home">
          <Select
            value={form.home_id ?? NO_HOME}
            onValueChange={(v) => set({ home_id: v === NO_HOME ? null : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HOME}>No home</SelectItem>
              {homes.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Clock-in distance">
          <Select
            value={String(form.geofence_radius_feet)}
            onValueChange={(v) => set({ geofence_radius_feet: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GEOFENCE_OPTIONS.map((o) => (
                <SelectItem key={o.feet} value={String(o.feet)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}
