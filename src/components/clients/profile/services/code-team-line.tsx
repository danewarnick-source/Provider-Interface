// "Team on SLN: Maria Lopez, Devin Park." on an authorization card: the
// active team members assigned this code (the Team section's data), each a
// link to Team. Nobody → "No one assigned to SLN yet" with a link to Team.

import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

const LINK = "font-medium text-[var(--hive-info-fg)] hover:underline";

export function CodeTeamLine({
  clientId,
  code,
  team,
}: {
  clientId: string;
  code: string;
  team: readonly { id: string; name: string }[];
}) {
  const toTeam = (children: ReactNode) => (
    <Link
      to="/dashboard/clients/$clientId"
      params={{ clientId }}
      search={{ section: "team" }}
      className={LINK}
    >
      {children}
    </Link>
  );
  return (
    <p className="text-xs text-muted-foreground" data-testid="authorization-team">
      {team.length ? (
        <>
          Team on <span className="font-mono">{code}</span>:{" "}
          {team.map((m, i) => (
            <Fragment key={m.id}>
              {i ? ", " : null}
              {toTeam(m.name)}
            </Fragment>
          ))}
          .
        </>
      ) : (
        <>
          No one assigned to <span className="font-mono">{code}</span> yet · {toTeam("Open Team")}
        </>
      )}
    </p>
  );
}
