// Office › Scheduler: the board (components/scheduler/board/). This file only
// reads the URL (view, place filter, week or month, and Nectar's ?focus=) and
// sends people without scheduling access back to the dashboard.
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { SchedulerBoard, type BoardSearch } from "@/components/scheduler/board/scheduler-board";

type Search = Partial<BoardSearch> & { focus?: string };

const VIEWS = ["homes", "staff", "clients"] as const;
const pick = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;

export const Route = createFileRoute("/dashboard/scheduler")({
  head: () => ({
    meta: [
      { title: "Scheduler — Provider Interface" },
      { name: "description", content: "The week's shifts by home, team member and client" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    view: pick(s.view, VIEWS),
    show: typeof s.show === "string" ? s.show : undefined,
    range: pick(s.range, ["week", "month"] as const),
    week: typeof s.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.week) ? s.week : undefined,
    focus: typeof s.focus === "string" ? s.focus : undefined,
  }),
  component: SchedulerPage,
});

function SchedulerPage() {
  const access = useAccess();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (access.isLoading)
    return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading…</p>;
  if (!access.canCategory("scheduling", "view")) return <Navigate to="/dashboard" replace />;
  return (
    <SchedulerBoard
      search={{
        view: search.view ?? "homes",
        show: search.show ?? "all",
        range: search.range ?? "week",
        week: search.week,
      }}
      onSearch={(p) => void navigate({ search: (prev) => ({ ...prev, ...p }), replace: true })}
    />
  );
}
