// "Lives with <host> · <home>" under a host home client's name. The host is the
// home's lead (teams.manager_id), set in Settings › Homes; this line only reads
// it and links there. Shown only when the client's home is a host home.
import { Link } from "@tanstack/react-router";
import type { ClientProfileData } from "./use-client-profile";

export function HostLine({ home }: { home: ClientProfileData["home"] }) {
  if (!home?.isHostHome) return null;
  return (
    <p className="mt-1 text-sm text-muted-foreground" data-testid="client-host-line">
      {home.hostName ? (
        <Link
          to="/dashboard/settings/homes/$teamId"
          params={{ teamId: home.id }}
          className="hover:underline"
        >
          Lives with {home.hostName} · {home.name}
        </Link>
      ) : (
        <>
          {home.name} · no host set ·{" "}
          <Link
            to="/dashboard/settings/homes/$teamId"
            params={{ teamId: home.id }}
            hash="lead"
            className="font-medium text-primary hover:underline"
          >
            + Set host
          </Link>
        </>
      )}
    </p>
  );
}
