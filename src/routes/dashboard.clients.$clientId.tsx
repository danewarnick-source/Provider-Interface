// Client profile: side-menu sections in ?section=. Old ?tab= deep links are
// redirected to the section that now holds them. Page body lives in
// components/clients/profile/client-profile-page.tsx.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { RequirePermission } from "@/components/rbac-guard";
import { ClientProfilePage } from "@/components/clients/profile/client-profile-page";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";
import {
  CLIENT_PROFILE_SECTIONS,
  clientSectionSearchValue,
  sectionForLegacyTab,
} from "@/lib/clients/profile-sections";

const profileSearch = z.object({
  section: z.enum(CLIENT_PROFILE_SECTIONS).optional().catch(undefined),
  tab: z.string().max(40).optional().catch(undefined),
});

export const Route = createFileRoute("/dashboard/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client Profile — Provider Interface" }] }),
  validateSearch: (s: Record<string, unknown>) => profileSearch.parse(s),
  beforeLoad: ({ params, search }) => {
    redirectUnlessUuidParam(params.clientId, {
      createTo: "/dashboard/clients/new",
      fallbackTo: "/dashboard/clients",
    });
    if (search.tab !== undefined) {
      const legacy = sectionForLegacyTab(search.tab);
      throw redirect({
        to: "/dashboard/clients/$clientId",
        params: { clientId: params.clientId },
        search: {
          section: search.section ?? (legacy ? clientSectionSearchValue(legacy) : undefined),
        },
        replace: true,
      });
    }
  },
  component: () => (
    <RequirePermission perm="view_clients">
      <ClientProfilePage />
    </RequirePermission>
  ),
});
