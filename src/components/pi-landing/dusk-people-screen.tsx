import { PiMark } from "@/components/pi-landing/pi-mark";

type PersonRow = {
  initials: string;
  name: string;
  program: string;
  status: "Enrolled" | "Scheduled" | "Completed" | "In Progress";
  assigned: string;
  last: string;
  tone: "pt" | "pt2" | "acct";
};

const ROWS: PersonRow[] = [
  { initials: "AM", name: "Alex Morgan", program: "Intensive Outpatient", status: "Enrolled", assigned: "K. Anderson", last: "2h ago", tone: "pt" },
  { initials: "JL", name: "Jordan Lee", program: "Outpatient", status: "Enrolled", assigned: "M. Johnson", last: "4h ago", tone: "acct" },
  { initials: "TK", name: "Taylor Kim", program: "Aftercare", status: "Scheduled", assigned: "S. Patel", last: "6h ago", tone: "pt2" },
  { initials: "CN", name: "Casey Nguyen", program: "Telehealth", status: "Completed", assigned: "J. Thompson", last: "1d ago", tone: "pt" },
  { initials: "RS", name: "Riley Smith", program: "Telehealth", status: "In Progress", assigned: "S. Thompson", last: "1d ago", tone: "acct" },
];

const AVATAR_TONE: Record<PersonRow["tone"], string> = {
  pt: "bg-pt text-pri",
  pt2: "bg-pt2 text-deep",
  acct: "bg-acct text-accd",
};

function statusClass(status: PersonRow["status"]) {
  if (status === "Enrolled") return "bg-acct text-accd ring-1 ring-acctb";
  return "bg-pt text-pri";
}

function NavGlyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

/** Decorative Denim admin still (people list). Not a live app surface. */
export function DuskPeopleScreen() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[var(--denim-bg)] text-ink" aria-hidden>
      <aside className="flex w-11 shrink-0 flex-col items-center gap-3 bg-[image:var(--denim-sidebar-bg)] py-3 text-ondarkp sm:w-12">
        <PiMark variant="brand" className="h-6 w-6" />
        <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white shadow-[inset_2px_0_0_var(--denim-acc)]">
          <NavGlyph d="M5 7h14M5 12h14M5 17h10" />
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg">
          <NavGlyph d="M12 5v14M5 12h14" />
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg">
          <NavGlyph d="M7 6h10v12H7zM9 10h6M9 14h4" />
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg">
          <NavGlyph d="M6 8h12M8 6v4M16 6v4M6 12h12v6H6z" />
        </span>
      </aside>

      <div className="min-w-0 flex-1 px-3 py-2.5 sm:px-5 sm:py-3.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[1.35rem] font-bold tracking-[-0.025em] text-deep sm:text-[1.7rem]">
            People
          </h2>
          <span className="rounded-full bg-pri px-3 py-1 text-[11px] font-semibold text-white">
            + New
          </span>
        </div>

        <div className="mt-2.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[11px] text-muted-foreground sm:mt-3">
          Search people...
        </div>

        <div className="mt-3 overflow-hidden rounded-xl bg-paper shadow-[var(--denim-shadow-sm)]">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_0.7fr_0.8fr_0.55fr] gap-2 bg-pt0 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-[10px]">
            <span>Name</span>
            <span>Program</span>
            <span>Status</span>
            <span>Assigned</span>
            <span>Last activity</span>
          </div>
          <div className="divide-y divide-line">
            {ROWS.map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_0.7fr_0.8fr_0.55fr] items-center gap-2 px-2 py-1.5 sm:py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[8px] font-semibold tracking-wide ${AVATAR_TONE[row.tone]}`}
                  >
                    {row.initials}
                  </span>
                  <span className="truncate text-[11px] font-medium text-ink sm:text-xs">{row.name}</span>
                </span>
                <span className="truncate text-[10px] text-body sm:text-[11px]">{row.program}</span>
                <span className={`justify-self-start truncate rounded-full px-1.5 py-px text-[9px] font-semibold sm:text-[10px] ${statusClass(row.status)}`}>
                  {row.status}
                </span>
                <span className="truncate text-[10px] text-body sm:text-[11px]">{row.assigned}</span>
                <span className="truncate text-[10px] text-muted-foreground sm:text-[11px]">{row.last}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
