import { createFileRoute, type SearchSchemaInput } from "@tanstack/react-router";
import { z } from "zod";
import { RequirePermission } from "@/components/rbac-guard";
import { TeamRosterPage } from "@/components/team-members/roster/team-roster-page";

/**
 * Team Members roster search params. Every param is optional and a bad value
 * is dropped instead of failing the route, so old links keep landing here.
 *
 * The router JSON-parses `?add=1` to the number 1 and would quote a string
 * "1" back into the address, so links pass the number and the page reads the
 * validated string "1".
 *
 * `filter` is one key; an old comma list keeps its first valid key
 * (parseRosterFilter). The retired `preset` param is dropped.
 */
type RosterSearchInput = {
  view?: "active" | "invited" | "inactive";
  q?: string;
  filter?: string;
  home?: string;
  position?: string;
  supervisor?: string;
  sort?: string;
  add?: 1 | "1";
  import?: 1 | "1";
};

const flag = z.coerce.string().pipe(z.literal("1")).optional().catch(undefined);
const text = z.coerce.string().optional().catch(undefined);

const rosterSearch = z.object({
  view: z.enum(["active", "invited", "inactive"]).optional().catch(undefined),
  q: text,
  filter: text,
  home: text,
  position: text,
  supervisor: text,
  sort: text,
  add: flag,
  import: flag,
});

export const Route = createFileRoute("/dashboard/team-members/")({
  head: () => ({ meta: [{ title: "Team Members — Provider Interface" }] }),
  validateSearch: (s: RosterSearchInput & SearchSchemaInput) => rosterSearch.parse(s),
  component: () => (
    <RequirePermission perm="view_staff_records">
      <TeamRosterPage />
    </RequirePermission>
  ),
});
