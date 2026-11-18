// Details of one home: name, kind, lead (the host, on a host home), address and
// licensed capacity. Text fields save on blur, selects on pick ("Home saved",
// "Host saved"); the new value stays in place. Read-only without edit access.
// #name (from + Add home) focuses Name; #lead (from "+ Set host") focuses the lead.
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { HOME_KINDS, leadLabel, type HomeKind } from "@/lib/homes/home-kind";
import { capacityFromText, homePatchProblems, type HomePatch } from "@/lib/homes/home-setup";
import { saveHome } from "@/lib/homes/homes.functions";
import type { HomeDetail } from "@/lib/homes/homes-load.server";
import { HomeLeadField } from "./home-lead-field";
import { useRefreshHomes } from "./use-homes";

export function HomeDetailsCard({
  orgId,
  detail,
  canEdit,
}: {
  orgId: string;
  detail: HomeDetail;
  canEdit: boolean;
}) {
  const { home } = detail;
  const refresh = useRefreshHomes();
  const saveFn = useServerFn(saveHome);
  const save = useMutation({
    mutationFn: (patch: HomePatch) =>
      saveFn({ data: { organizationId: orgId, teamId: home.id, patch } }),
    onSuccess: (_r, patch) => {
      const lead = leadLabel(patch.team_type ?? home.kind);
      toast.success(
        "manager_id" in patch ? `${lead} ${patch.manager_id ? "saved" : "removed"}` : "Home saved",
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const send = (patch: HomePatch) => {
    const problem = homePatchProblems(patch)[0];
    if (problem) toast.error(problem);
    else save.mutate(patch);
  };

  const [name, setName] = useState(home.name);
  const [address, setAddress] = useState(home.address ?? "");
  const [capacity, setCapacity] = useState(home.capacity?.toString() ?? "");
  useEffect(() => setName(home.name), [home.name]);
  useEffect(() => setAddress(home.address ?? ""), [home.address]);
  useEffect(() => setCapacity(home.capacity?.toString() ?? ""), [home.capacity]);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (canEdit && window.location.hash === "#name") nameRef.current?.select();
  }, [canEdit]);

  return (
    <SectionCard icon={Info} title="Details" description="What the home is and who leads it.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="home-name">Name</Label>
          <Input
            id="home-name"
            ref={nameRef}
            value={name}
            readOnly={!canEdit}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== home.name && send({ team_name: name })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="home-kind">Kind of home</Label>
          <Select
            value={home.kind}
            disabled={!canEdit || save.isPending}
            onValueChange={(v) => send({ team_type: v as HomeKind })}
          >
            <SelectTrigger id="home-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOME_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit ? (
          <HomeLeadField
            teamType={home.kind}
            leadId={home.leadId}
            people={detail.people}
            residentNames={detail.residents.map((r) => r.firstName)}
            saving={save.isPending}
            onSave={(leadId) => send({ manager_id: leadId })}
          />
        ) : (
          <div className="grid gap-1.5">
            <Label>{leadLabel(home.kind)}</Label>
            <p className="text-sm">
              {detail.people.find((p) => p.id === home.leadId)?.name ?? "Not set"}
            </p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="home-capacity">Licensed capacity</Label>
          <Input
            id="home-capacity"
            inputMode="numeric"
            value={capacity}
            readOnly={!canEdit}
            placeholder="Blank if not licensed for a number"
            onChange={(e) => setCapacity(e.target.value)}
            onBlur={() => {
              const next = capacityFromText(capacity);
              if (next !== home.capacity) send({ capacity: next });
            }}
          />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="home-address">Address</Label>
          <Input
            id="home-address"
            value={address}
            readOnly={!canEdit}
            maxLength={200}
            placeholder="Street, city, state ZIP"
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() =>
              (address.trim() || null) !== home.address && send({ address: address || null })
            }
          />
        </div>
      </div>
    </SectionCard>
  );
}
