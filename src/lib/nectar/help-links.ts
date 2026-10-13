// Admin help deep links. The model picks a path; PI shows it only when it is
// a real screen from this list. A dynamic segment ($clientId, $staffId) must
// be a real id, never the literal placeholder.

import type { FileRoutesByFullPath } from "../../routeTree.gen.ts";

/**
 * Screens admin help may link to. Type-checked against the generated route tree.
 * Every sidebar screen is here (help-links.test.ts reads the sidebar arrays in
 * routes/dashboard.tsx), so any path in the help prompt's map can be a link.
 */
export const HELP_LINK_ROUTES = [
  "/dashboard",
  "/dashboard/agency-documents",
  "/dashboard/ask-nectar",
  "/dashboard/billing",
  "/dashboard/billing/$clientId",
  "/dashboard/billing/form520",
  "/dashboard/billing/imports",
  "/dashboard/billing/nectar",
  "/dashboard/clients",
  "/dashboard/clients/$clientId",
  "/dashboard/compliance",
  "/dashboard/compliance-desk",
  "/dashboard/daily-logs",
  "/dashboard/evidence",
  "/dashboard/help",
  "/dashboard/hive-training/",
  "/dashboard/hub/clients",
  "/dashboard/hub/documentation",
  "/dashboard/hub/finances",
  "/dashboard/hub/knowledge",
  "/dashboard/inbox",
  "/dashboard/my-historical-records",
  "/dashboard/my-obligations",
  "/dashboard/my-time-corrections",
  "/dashboard/pba-ledger",
  "/dashboard/personnel-file",
  "/dashboard/schedule",
  "/dashboard/scheduler",
  "/dashboard/scheduling",
  "/dashboard/settings",
  "/dashboard/summaries",
  "/dashboard/team-members/",
  "/dashboard/team-members/$staffId",
  "/dashboard/teams",
  "/dashboard/timeclock",
] as const satisfies readonly (keyof FileRoutesByFullPath)[];

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUERY_PART_RE = /^[A-Za-z0-9_-]+=[A-Za-z0-9_.-]*$/;

function matchesRoute(segments: string[], route: string): boolean {
  const want = route.split("/").filter(Boolean);
  return (
    want.length === segments.length &&
    want.every((part, i) => (part.startsWith("$") ? ID_RE.test(segments[i]) : part === segments[i]))
  );
}

/** The path to show for a model-chosen link, or null when it is not a real admin screen. */
export function realHelpPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || /[#\\\s]/.test(raw)) return null;
  const [pathname, query, ...extra] = raw.split("?");
  if (extra.length > 0) return null;
  if (query !== undefined && !query.split("&").every((part) => QUERY_PART_RE.test(part))) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (!HELP_LINK_ROUTES.some((route) => matchesRoute(segments, route))) return null;
  const clean = `/${segments.join("/")}`;
  return query ? `${clean}?${query}` : clean;
}

/** The reply's deepLink, kept only when its path is a real screen. */
export function helpDeepLink(raw: unknown): { path: string; label: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { path, label } = raw as { path?: unknown; label?: unknown };
  const real = realHelpPath(path);
  if (!real) return null;
  return { path: real, label: typeof label === "string" && label.trim() ? label : "Take me there" };
}
