import { createFileRoute, redirect } from "@tanstack/react-router";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LegacySearch = {
  tab?: string;
  new?: boolean;
  obligation?: string;
};

function parseLegacySearch(s: Record<string, unknown>): LegacySearch {
  const openNew = s.new === "1" || s.new === 1 || s.new === true || s.new === "true";
  const obligation =
    typeof s.obligation === "string" && UUID_RE.test(s.obligation) ? s.obligation : undefined;
  const tabRaw = typeof s.tab === "string" ? s.tab.trim() : undefined;
  return {
    ...(tabRaw ? { tab: tabRaw } : {}),
    ...(openNew ? { new: true as const } : {}),
    ...(obligation ? { obligation } : {}),
  };
}

/**
 * Legacy company-obligations / Obligations register.
 * Primary admin surface is now Evidence.
 */
export const Route = createFileRoute("/dashboard/company-obligations")({
  head: () => ({ meta: [{ title: "Evidence — Provider Interface" }] }),
  validateSearch: parseLegacySearch,
  beforeLoad: ({ search }) => {
    const tab = typeof search.tab === "string" ? search.tab : "";
    const mapped =
      tab === "client"
        ? "client"
        : tab === "policy-library" || tab === "policies"
          ? "company"
          : "staff";
    throw redirect({
      to: "/dashboard/evidence",
      search: { tab: mapped },
      replace: true,
    });
  },
});
