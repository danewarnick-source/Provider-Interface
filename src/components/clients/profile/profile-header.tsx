// Client profile header, the "soft panel": muted surface with an ink top
// stripe. Top row: photo, name, "Goes by · age · home", code and readiness
// pills; Upload PCSP and the ⋯ menu (rarer actions). Bottom row:
// Guardian, Support coordinator and Plan year ends tiles, each opening the
// section that holds it.

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/person/person-avatar";
import { useAccess } from "@/hooks/use-access";
import { useClientCareData } from "@/hooks/use-client-care-data";
import { useAllClientContacts } from "@/components/clients/shared/hooks/use-client-contacts";
import { primaryContact } from "@/lib/clients/contacts";
import { guardianStatus } from "@/lib/clients/guardian";
import { ageOn, formatDate } from "@/lib/clients/dates";
import { DISCHARGED_STATUSES } from "@/lib/clients/list";
import type { AttentionItem } from "@/lib/clients/readiness";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";
import {
  goesByLine,
  guardianTile,
  headerReadiness,
  planYearTile,
  preferredNameFrom,
} from "@/lib/clients/profile-header";
import { InfoTile } from "./cards/card-parts";
import type { ClientProfileData } from "./use-client-profile";
import { HeaderMenu } from "./header-menu";
import { HeaderPills } from "./header-pills";
import { PcspUploadButton } from "./plans/pcsp-upload-button";

export function isDischarged(status: string | null | undefined): boolean {
  return (DISCHARGED_STATUSES as readonly string[]).includes(status ?? "");
}

export function ClientProfileHeader({
  orgId,
  data,
  attention,
  onSelect,
  onChanged,
}: {
  orgId: string;
  data: ClientProfileData;
  /** The needs-attention list; null while it loads. */
  attention: AttentionItem[] | null;
  onSelect: (section: ClientProfileSection) => void;
  onChanged: () => void;
}) {
  const { client } = data;
  const canEdit = useAccess().canCategory("clients", "edit");
  const care = useClientCareData(client.id);
  const discharged = isDischarged(client.account_status);
  const subtitle = goesByLine({
    preferredName: preferredNameFrom(care.data?.custom_fields),
    firstName: client.first_name,
    age: ageOn(client.date_of_birth),
    home: data.home?.name,
  });
  // Same cached contacts as the Contacts section, so a save there updates these tiles.
  const contacts = useAllClientContacts(client.id).data;
  const guardian = contacts
    ? guardianTile(guardianStatus(client.is_own_guardian, contacts))
    : { value: "…", missing: false };
  const coordinator = contacts
    ? (primaryContact(contacts, "support_coordinator")?.name ?? "Not on file")
    : "…";
  const plan = planYearTile(
    data.pcsp.kind === "none" ? null : data.pcsp.endDate,
    data.pcsp,
    (d) => formatDate(d),
  );

  return (
    <div className="space-y-3" data-testid="client-profile-header">
      <Button variant="ghost" asChild className="-ml-2">
        <Link to="/dashboard/clients" data-testid="client-profile-back">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Link>
      </Button>
      <section className="relative min-w-0 overflow-hidden rounded-2xl border border-hive-border bg-[var(--hive-muted-surface)] p-5 pt-6 md:p-6 md:pt-7">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-hive-ink" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 basis-72 items-start gap-4">
            <PersonAvatar
              bucket="client-photos"
              path={client.client_photo_url}
              name={data.name}
              className="h-[76px] w-[76px] shrink-0 border-0 bg-hive-ink text-xl text-white shadow-md ring-4 ring-white"
            />
            <div className="min-w-0">
              <h1
                className="break-words text-[26px] font-bold leading-tight text-hive-ink"
                data-testid="client-profile-heading"
              >
                {data.name}
              </h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              <HeaderPills
                codes={data.codes}
                readiness={headerReadiness(attention)}
                discharged={
                  discharged
                    ? `Discharged${client.discharge_date ? ` ${formatDate(client.discharge_date)}` : ""}`
                    : null
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:[&_button]:min-h-11">
            {canEdit && !discharged ? (
              <PcspUploadButton
                clientId={client.id}
                orgId={orgId}
                label="Upload PCSP"
                inputTestId="header-pcsp-upload-input"
              />
            ) : null}
            <HeaderMenu orgId={orgId} data={data} discharged={discharged} onChanged={onChanged} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InfoTile
            label="Guardian"
            value={guardian.value}
            warn={guardian.missing}
            link={{ label: "Open Contacts", onClick: () => onSelect("contacts") }}
            testId="client-header-guardian"
          />
          <InfoTile
            label="Support coordinator"
            value={coordinator}
            link={{ label: "Open Contacts", onClick: () => onSelect("contacts") }}
            testId="client-header-coordinator"
          />
          <InfoTile
            label="Plan year ends"
            value={plan.value}
            note={plan.note}
            warn={plan.warn}
            link={{ label: "Open Plans", onClick: () => onSelect("plans") }}
            testId="client-header-plan-year"
          />
        </div>
      </section>
    </div>
  );
}
