// The rows of the week grid for each view. Homes & programs: one row per
// staffed home or day program; its name opens the home in Settings › Homes.
// Team members: an Open shifts row, then one row per person with an hours
// meter, time off and a + that locks Add shift to them. Clients: one row per
// client with a 1056 meter; host home clients say "With host · Not scheduled"
// each day (host-away is B7b). Coverage gaps stay hidden until homes have
// coverage needs (B7).
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  clientName,
  clientPlace,
  codeActiveOn,
  homeCode,
  inFilter,
  isOpenShift,
  shiftDay,
  shiftPlace,
  staffHours,
  type BoardShift,
  type FilterKey,
  type View,
} from "@/lib/scheduler/board-model";
import { homeKind } from "@/lib/homes/home-kind";
import type { AddDraft, Board } from "./board-context";
import { newDraft } from "./add-draft";
import { CodeTag } from "./board-ui";
import type { OutlookRow } from "@/lib/scheduler/board-data";

export type BoardRow = {
  key: string;
  head: ReactNode;
  shiftsOn: (day: string) => BoardShift[];
  extrasOn?: (day: string) => ReactNode;
  addAt?: (day: string) => AddDraft | null;
  /** Dropping a chip here from another row puts this on the shift (Team members: the person). */
  dropPatch?: Partial<BoardShift>;
};

const byStart = (a: BoardShift, b: BoardShift) => a.starts_at.localeCompare(b.starts_at);
const on = (list: BoardShift[], day: string) =>
  list.filter((s) => shiftDay(s) === day).sort(byStart);

function Meter({ pct, tone }: { pct: number; tone: "ok" | "warn" | "crit" }) {
  const color =
    tone === "ok" ? "var(--hive-ok)" : tone === "warn" ? "var(--hive-gold)" : "var(--hive-danger)";
  return (
    <div className="mt-1 h-1.5 w-full rounded bg-[var(--hive-muted-surface)]">
      <div
        className="h-1.5 rounded"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

function Head({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-[150px] text-xs">
      <div className="text-[13px] font-bold">{title}</div>
      {sub && <div className="text-[var(--hive-text-muted)]">{sub}</div>}
      {children}
    </div>
  );
}

const OffChip = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-1 rounded-md bg-[var(--hive-muted-surface)] px-1.5 py-1 text-[11px] leading-tight text-[var(--hive-text-muted)]">
    <b className="block text-[var(--hive-text)]">{title}</b>
    {sub}
  </div>
);

function homeRows(b: Board, filter: FilterKey, live: BoardShift[]): BoardRow[] {
  return b.data.teams
    .filter((t) => homeCode(t.team_type) && inFilter(filter, t.id))
    .map((t) => {
      const mine = live.filter(
        (s) => !s.parent_shift_id && shiftPlace(s, b.clients, b.teams) === t.id,
      );
      const residents = b.data.clients.filter((c) => c.team_id === t.id).length;
      return {
        key: `team:${t.id}`,
        head: (
          <Head
            title={
              <Link
                to="/dashboard/settings/homes/$teamId"
                params={{ teamId: t.id }}
                className="hover:underline"
              >
                {t.team_name}
              </Link>
            }
            sub={
              <>
                <CodeTag code={homeCode(t.team_type)} /> · {residents} residents
              </>
            }
          />
        ),
        shiftsOn: (d) => on(mine, d),
        addAt: (d) => newDraft(b, { day: d, placeKey: `team:${t.id}` }),
      };
    });
}

function staffRows(b: Board, filter: FilterKey, live: BoardShift[]): BoardRow[] {
  const inPlace = (s: BoardShift) => inFilter(filter, shiftPlace(s, b.clients, b.teams));
  const open = live.filter((s) => isOpenShift(s) && inPlace(s));
  const openRow: BoardRow = {
    key: "open",
    head: <Head title="Open shifts" sub={open.length ? `${open.length} to fill` : "All filled"} />,
    shiftsOn: (d) => on(open, d),
  };
  const people = b.data.staff.filter(
    (p) =>
      filter === "all" ||
      live.some((s) => s.staff_id === p.id && inPlace(s)) ||
      b.data.assigns.some(
        (a) => a.staff_id === p.id && clientPlace(b.clients.get(a.client_id), b.teams) === filter,
      ),
  );
  return [
    openRow,
    ...people.map((p): BoardRow => {
      const mine = live.filter((s) => s.staff_id === p.id);
      const h = staffHours(mine, p.id);
      const over = h > b.data.otHours;
      const off = b.data.timeOff.filter((t) => t.staff_id === p.id);
      return {
        key: `staff:${p.id}`,
        head: (
          <Head title={p.name}>
            <Meter
              pct={(h / 48) * 100}
              tone={over ? "crit" : h >= b.data.otHours - 4 ? "warn" : "ok"}
            />
            <span className="text-[var(--hive-text-muted)]">
              {h} h this week{over && <b className="text-[var(--hive-danger)]"> · overtime</b>}
            </span>
          </Head>
        ),
        shiftsOn: (d) => on(mine.filter(inPlace), d),
        extrasOn: (d) =>
          off
            .filter((t) => t.start_date <= d && d <= t.end_date)
            .map((t, i) => (
              <OffChip
                key={i}
                title={t.status === "approved" ? "Off" : "Off?"}
                sub={t.status === "approved" ? "Time off approved" : "Request waiting"}
              />
            )),
        addAt: (d) => newDraft(b, { day: d, staffId: p.id, lock: true }),
        dropPatch: { staff_id: p.id },
      };
    }),
  ];
}

function clientRows(
  b: Board,
  filter: FilterKey,
  live: BoardShift[],
  days: string[],
  outlook: OutlookRow[],
): BoardRow[] {
  const codesOf = (id: string) =>
    b.data.codes.filter((c) => c.client_id === id && days.some((d) => codeActiveOn(c, d)));
  return b.data.clients
    .filter((c) => codesOf(c.id).length && inFilter(filter, clientPlace(c, b.teams)))
    .sort((x, y) => clientName(x).localeCompare(clientName(y)))
    .map((c): BoardRow => {
      const codes = [...new Set(codesOf(c.id).map((x) => x.service_code.toUpperCase()))];
      const home = c.team_id ? b.teams.get(c.team_id) : undefined;
      const host = codes.includes("HHS") || homeKind(home?.team_type) === "host_home";
      const mine = live.filter((s) => s.client_id === c.id);
      const rows = outlook.filter((o) => o.clientId === c.id);
      const scheduled = codes.find((x) => !["HHS", "PPS", "RHS"].includes(x));
      const sub = host ? (
        <>
          <CodeTag code="HHS" /> · lives with {home?.team_name ?? "a host"}
        </>
      ) : (
        codes.join(" · ")
      );
      return {
        key: `client:${c.id}`,
        head: (
          <Head title={clientName(c)} sub={sub}>
            {rows.map((o) => (
              <div key={o.code}>
                {o.unit === "h" && (
                  <Meter
                    pct={(o.outlook.used / (o.authorized || 1)) * 100}
                    tone={
                      o.outlook.left < 0
                        ? "crit"
                        : o.outlook.used > o.authorized * 0.9
                          ? "warn"
                          : "ok"
                    }
                  />
                )}
                <span className="tabular-nums text-[var(--hive-text-muted)]">
                  {o.code}: {o.outlook.used} of {o.authorized} {o.unit} this plan year
                </span>
              </div>
            ))}
          </Head>
        ),
        shiftsOn: (d) => on(mine, d),
        extrasOn: host ? () => <OffChip title="With host" sub="Not scheduled" /> : undefined,
        addAt: scheduled
          ? (d) => newDraft(b, { day: d, placeKey: `client:${c.id}:${scheduled}` })
          : undefined,
      };
    });
}

export function buildRows(
  b: Board,
  view: View,
  filter: FilterKey,
  outlook: OutlookRow[],
): BoardRow[] {
  // Cancelled shifts stay on the board, greyed (they're kept on record).
  const live = b.shifts;
  if (view === "homes") return homeRows(b, filter, live);
  if (view === "staff") return staffRows(b, filter, live);
  return clientRows(b, filter, live, b.days, outlook);
}
