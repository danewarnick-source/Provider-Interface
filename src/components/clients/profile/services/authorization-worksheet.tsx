// "Worksheet weekly hours" and "Absence days per year" on an RHS authorization
// card, next to Ratio (B7). The group home page reads them: hours scheduled
// vs the Worksheet (§1.33) and absence days "x of y" (§21.3(3)). Billing: Edit
// holders type a number and it saves when the field loses focus ("Worksheet
// saved"); everyone else sees the values.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { saveAuthorizationWorksheet } from "@/lib/clients/services/services.functions";
import { useRefreshServices } from "./use-client-services";

type Props = {
  orgId: string;
  clientId: string;
  id: string;
  weeklyHours: number | null;
  absenceDays: number | null;
  canEdit: boolean;
};

const parse = (v: string) => (v.trim() === "" ? null : Number(v));
const text = (v: number | null) => (v == null ? "" : String(v));

export function AuthorizationWorksheet(p: Props) {
  const refresh = useRefreshServices(p.clientId);
  const saveFn = useServerFn(saveAuthorizationWorksheet);
  const [hours, setHours] = useState(text(p.weeklyHours));
  const [days, setDays] = useState(text(p.absenceDays));
  const save = useMutation({
    mutationFn: (v: { weeklyHours: number | null; absenceDays: number | null }) =>
      saveFn({ data: { organizationId: p.orgId, clientId: p.clientId, id: p.id, ...v } }),
    onSuccess: () => {
      toast.success("Worksheet saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!p.canEdit)
    return (
      <p className="text-xs text-muted-foreground">
        Worksheet: {p.weeklyHours == null ? "no weekly hours" : `${p.weeklyHours} h a week`} ·{" "}
        {p.absenceDays == null ? "no absence days" : `${p.absenceDays} absence days a year`}
      </p>
    );

  const commit = () => {
    const weeklyHours = parse(hours);
    const absenceDays = parse(days);
    if (weeklyHours === p.weeklyHours && absenceDays === p.absenceDays) return;
    if (weeklyHours != null && !(weeklyHours >= 0 && weeklyHours <= 168))
      return toast.error("Weekly hours is a number from 0 to 168.");
    if (absenceDays != null && !(Number.isInteger(absenceDays) && absenceDays >= 0))
      return toast.error("Absence days is a whole number, 0 or more.");
    save.mutate({ weeklyHours, absenceDays });
  };
  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    step: string,
  ) => (
    <label htmlFor={id} className="flex items-center gap-2">
      {label}
      <Input
        id={id}
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        value={value}
        disabled={save.isPending}
        onChange={(e) => set(e.target.value)}
        onBlur={commit}
        className="h-8 w-[84px] max-md:h-11"
      />
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {field(`ws-hours-${p.id}`, "Worksheet weekly hours", hours, setHours, "0.25")}
      {field(`ws-days-${p.id}`, "Absence days per year", days, setDays, "1")}
    </div>
  );
}
