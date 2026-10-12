import type { ReactNode } from "react";
import { PiMark } from "@/components/pi-landing/pi-mark";
import { PI_PRODUCT_SHOTS } from "@/lib/pi-landing";
import { DuskPeopleScreen } from "@/components/pi-landing/dusk-people-screen";

function NavGlyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function ShotChrome({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <div
      className="flex h-full min-h-[220px] overflow-hidden rounded-[16px] bg-[var(--denim-bg)] text-ink shadow-[var(--denim-shadow),0_40px_80px_-30px_rgba(27,51,80,0.45)]"
      aria-hidden
    >
      <aside className="flex w-10 shrink-0 flex-col items-center gap-3 bg-[image:var(--denim-sidebar-bg)] py-3 text-ondarkp sm:w-11">
        <PiMark variant="brand" className="h-5 w-5" />
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white shadow-[inset_2px_0_0_var(--denim-acc)]">
          <NavGlyph d="M5 7h14M5 12h14M5 17h10" />
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-lg">
          <NavGlyph d="M7 6h10v12H7zM9 10h6M9 14h4" />
        </span>
      </aside>
      <div className="min-w-0 flex-1 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold tracking-[-0.01em] text-deep sm:text-lg">{title}</h3>
          {action ? (
            <span className="rounded-full bg-pri px-2.5 py-0.5 text-[10px] font-semibold text-white">
              {action}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function NectarShot() {
  return (
    <ShotChrome title="Nectar">
      <p className="mt-2 text-[11px] text-muted-foreground">With you while the day is happening</p>
      <div className="mt-3 space-y-2">
        {[
          { who: "You", text: "Does this note already cover the afternoon?" },
          { who: "Nectar", text: "The afternoon is already on the record. One sentence still needs your eye." },
          { who: "You", text: "Keep it as a draft." },
        ].map((row) => (
          <div key={row.text} className="rounded-lg bg-paper px-2.5 py-2 shadow-[var(--denim-shadow-sm)]">
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-pri">{row.who}</div>
            <div className="mt-0.5 text-[11px] text-ink">{row.text}</div>
          </div>
        ))}
      </div>
    </ShotChrome>
  );
}

function ScheduleShot() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const cells = ["Jordan · AM", "Taylor · PM", "Alex · AM", "Casey · PM", "Riley · AM"];
  return (
    <ShotChrome title="Schedule" action="This week">
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {days.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((c) => (
          <div
            key={c}
            className="rounded-lg bg-acct px-1 py-2 text-center text-[10px] font-medium text-accd ring-1 ring-acctb"
          >
            {c}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Coverage holds. Close the laptop.</p>
    </ShotChrome>
  );
}

function NotesShot() {
  return (
    <ShotChrome title="Notes" action="Already written">
      <div className="mt-3 space-y-2">
        {[
          { name: "Alex Morgan", note: "Afternoon visit complete. Evening still open on the record." },
          { name: "Jordan Lee", note: "Morning note signed. Nothing left to reconstruct." },
          { name: "Taylor Kim", note: "Draft waiting for your eye — Nectar left one sentence." },
        ].map((row) => (
          <div key={row.name} className="rounded-lg bg-paper px-2.5 py-2 shadow-[var(--denim-shadow-sm)]">
            <div className="text-[11px] font-medium text-ink">{row.name}</div>
            <div className="mt-0.5 text-[10px] text-body">{row.note}</div>
          </div>
        ))}
      </div>
    </ShotChrome>
  );
}

function TrainingsShot() {
  return (
    <ShotChrome title="Trainings" action="Packets">
      <div className="mt-3 space-y-2">
        {[
          { name: "CPR / First Aid", state: "Finished" },
          { name: "30-day orientation", state: "Assigned" },
          { name: "Mandt", state: "In packet" },
        ].map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-lg bg-paper px-2.5 py-2 shadow-[var(--denim-shadow-sm)]"
          >
            <span className="text-[11px] text-ink">{row.name}</span>
            <span className="rounded-full bg-acct px-2 py-px text-[10px] font-semibold text-accd">{row.state}</span>
          </div>
        ))}
      </div>
    </ShotChrome>
  );
}

function ShopShot() {
  return (
    <ShotChrome title="Shop" action="Seats">
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { name: "CPR / First Aid", price: "$100" },
          { name: "30-day", price: "$75" },
          { name: "Mandt", price: "$200" },
          { name: "Package", price: "$300" },
        ].map((row) => (
          <div key={row.name} className="rounded-lg bg-paper px-2.5 py-2 shadow-[var(--denim-shadow-sm)]">
            <div className="text-[11px] text-body">{row.name}</div>
            <div className="mt-1 font-display text-sm font-bold text-deep">{row.price}</div>
          </div>
        ))}
      </div>
    </ShotChrome>
  );
}

const SHOTS: Record<string, ReactNode> = {
  nectar: <NectarShot />,
  people: (
    <div className="overflow-hidden rounded-[16px] shadow-[var(--denim-shadow),0_40px_80px_-30px_rgba(27,51,80,0.45)]">
      <div className="aspect-[16/10] min-h-[220px]">
        <DuskPeopleScreen />
      </div>
    </div>
  ),
  schedule: <ScheduleShot />,
  notes: <NotesShot />,
  trainings: <TrainingsShot />,
  shop: <ShopShot />,
};

export function PiProductShots() {
  return (
    <section id="product" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-[100px]">
      <div className="mx-auto max-w-[1240px]">
        <p className="denim-eyebrow">The office</p>
        <h2
          className="mt-3 max-w-3xl font-display text-[clamp(36px,4.5vw,56px)] font-bold leading-[1.04] tracking-[-0.025em] text-deep [text-wrap:balance]"
        >
          Admin-first. The work you already do, in one room.
        </h2>
        <p className="mt-4 max-w-2xl text-base text-body sm:text-lg">
          Nectar, people, the schedule, notes already written, trainings, the shop. Not a caregiver app.
        </p>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {PI_PRODUCT_SHOTS.map((shot) => (
            <article key={shot.id} className="min-w-0">
              {SHOTS[shot.id]}
              <p className="denim-eyebrow mt-5">
                {shot.kicker}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold tracking-[-0.02em] text-deep">{shot.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{shot.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
