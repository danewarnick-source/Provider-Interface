// Setup steps 2, 4, 5 and 6. Each reuses the profile's own card, so it saves
// in the same place: Contacts (the Contacts section), Team (the team member
// cards), Behavior (the BSP upload) and the Client file (C5's pack review,
// pre-checked from their codes).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { needsBehaviorSupportPlan } from "@/lib/clients/bsp";
import type { ClientOverview } from "@/lib/clients/overview";
import type { SupportScope } from "@/lib/clients/support-scope";
import { ContactsSection } from "@/components/clients/profile/contacts/contacts-section";
import { TeamMembers } from "@/components/clients/profile/team/team-members";
import { BspCard } from "@/components/clients/profile/plans/bsp-card";
import { ClientPackReview } from "@/components/clients/profile/file/client-pack-review";
import { useClientFile } from "@/components/clients/profile/file/use-client-file";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { useSaveSupportScope } from "./use-support-scope";
import { YesNo } from "./yes-no";

const Lead = ({ children }: { children: string }) => (
  <p className="mb-4 text-sm text-muted-foreground">{children}</p>
);

export function StepContacts({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  return (
    <div data-testid="client-setup-contacts">
      <Lead>
        Add the guardian (or mark them their own guardian), the support coordinator, and anyone
        else we should know about: family, doctors, a day program.
      </Lead>
      <ContactsSection orgId={orgId} data={data} />
    </div>
  );
}

export function StepTeam({
  orgId,
  data,
  overview,
}: {
  orgId: string;
  data: ClientProfileData;
  overview: ClientOverview | null;
}) {
  const { canCategory } = useAccess();
  return (
    <div data-testid="client-setup-team">
      <Lead>Pick the team members who will work with them, and on which codes.</Lead>
      <TeamMembers
        orgId={orgId}
        clientId={data.client.id}
        firstName={data.client.first_name?.trim() || data.name}
        canEdit={canCategory("staff_roster", "edit")}
        readiness={overview?.team ?? []}
      />
    </div>
  );
}

export function StepBehavior({
  orgId,
  data,
  scope,
}: {
  orgId: string;
  data: ClientProfileData;
  scope: SupportScope | null;
}) {
  const save = useSaveSupportScope(orgId, data.client.id);
  const [answer, setAnswer] = useState<boolean | null>(scope?.has_bsp ?? null);
  const required = needsBehaviorSupportPlan(data.codes);
  return (
    <div data-testid="client-setup-behavior">
      <YesNo
        question="Do they have a behavior support plan?"
        value={answer}
        onChange={(v) => {
          setAnswer(v);
          save.mutate({ answers: { has_bsp: v } });
        }}
        noNote={
          required
            ? "Their behavior consultation codes still need a BSP; it's hidden until you turn it back on."
            : "The behavior support plan card stays hidden."
        }
      >
        <BspCard orgId={orgId} clientId={data.client.id} required={required} />
      </YesNo>
    </div>
  );
}

export function StepFile({
  orgId,
  data,
  onSaved,
}: {
  orgId: string;
  data: ClientProfileData;
  onSaved: () => void;
}) {
  const { canCategory, isAgencyAdmin } = useAccess();
  const canManage = canCategory("clients", "edit") && isAgencyAdmin;
  const { q, refresh } = useClientFile(orgId, data.client.id, canManage);
  const [reviewing, setReviewing] = useState(false);
  const packs = q.data?.groups.filter((g) => !["by_hand", "not_needed"].includes(g.key)) ?? [];
  return (
    <div className="space-y-3" data-testid="client-setup-file">
      <Lead>
        Choose the document packs their Client file keeps. They're pre-checked from their service
        codes.
      </Lead>
      {packs.length ? (
        <p className="text-sm">
          Packs now: <span className="font-medium">{packs.map((g) => g.title).join(", ")}</span>
        </p>
      ) : null}
      {canManage ? (
        <Button onClick={() => setReviewing(true)}>Choose document packs</Button>
      ) : (
        <p className="text-sm text-muted-foreground">An owner or admin chooses the document packs.</p>
      )}
      {reviewing ? (
        <ClientPackReview
          orgId={orgId}
          clientId={data.client.id}
          clientName={data.name}
          activeCodes={q.data?.activeCodes ?? data.codes}
          onClose={() => setReviewing(false)}
          onSaved={() => {
            refresh();
            onSaved();
          }}
        />
      ) : null}
    </div>
  );
}
