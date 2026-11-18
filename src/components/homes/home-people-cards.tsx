// Who lives at and works at one home, read-only. Residents come from each
// client's Home field (Clients owns it): a name opens the client, and
// + Add a resident opens Clients with a hint to set Home there. The team is
// every active team member assigned to a resident (Team members owns it).
import { Link } from "@tanstack/react-router";
import { HeartHandshake, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import type { HomeDetail } from "@/lib/homes/homes-load.server";

const rowLink =
  "flex min-h-11 items-center px-3 py-2 text-sm font-medium hover:bg-[var(--hive-hover)]";

export function HomeResidentsCard({ detail, canEdit }: { detail: HomeDetail; canEdit: boolean }) {
  const { residents, home } = detail;
  const add =
    canEdit && home.active ? (
      <Button asChild variant="outline">
        <Link to="/dashboard/clients" search={{ setHome: home.id }}>
          <Plus className="h-4 w-4" /> Add a resident
        </Link>
      </Button>
    ) : null;
  return (
    <SectionCard
      icon={HeartHandshake}
      title={`Residents · ${residents.length}`}
      description="From each client's Home field. Change where someone lives on their profile."
      actions={residents.length ? add : null}
    >
      {residents.length === 0 ? (
        <EmptyState action={add}>Nobody lives here yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-hive-border rounded-xl border border-hive-border">
          {residents.map((c) => (
            <li key={c.id}>
              <Link
                to="/dashboard/clients/$clientId"
                params={{ clientId: c.id }}
                search={{}}
                className={rowLink}
              >
                {c.firstName} {c.lastName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function HomeTeamCard({ detail }: { detail: HomeDetail }) {
  const { team, residents } = detail;
  return (
    <SectionCard
      icon={Users}
      title={`Team · ${team.length}`}
      description="Everyone assigned to a resident here. Assign team members on the client's Team tab."
    >
      {team.length === 0 ? (
        <EmptyState>
          {residents.length
            ? "No team members are assigned to the residents yet."
            : "The team is whoever is assigned to the residents. Nobody lives here yet."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-hive-border rounded-xl border border-hive-border">
          {team.map((p) => (
            <li key={p.id}>
              <Link
                to="/dashboard/team-members/$staffId"
                params={{ staffId: p.id }}
                search={{}}
                className={rowLink}
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
