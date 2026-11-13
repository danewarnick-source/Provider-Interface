// The ranked "who should take it" list, best fit first, with the rule engine's
// reasons on every row (find-staff.functions.ts → rank-staff.ts). Add shift
// uses it to pick a person (or Leave it open); Find staff uses it to assign.
// "Can't" rows show why and have no button; "Needs a reason" rows ask for the
// reason before they assign. Card and training reasons link to Evidence.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FIT_LABEL,
  isQualified,
  type FitLevel,
  type RankedCandidate,
} from "@/lib/scheduler/rank-staff";
import { Pill, type Tone } from "./board-ui";

const TONE: Record<FitLevel, Tone> = {
  ok: "ok",
  warn: "warn",
  reminder: "warn",
  reason: "warn",
  cant: "crit",
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const round = (n: number) => Math.round(n * 100) / 100;

function Why({ c, add }: { c: RankedCandidate; add: number }) {
  return (
    <span className="block text-xs text-[var(--hive-text-muted)]">
      {round(c.hoursThisWeek)} h → {round(c.hoursThisWeek + add)} h
      {c.reasons.length ? ` · ${c.reasons.join("; ")}` : " · no flags"}
    </span>
  );
}

export function nectarPick(list: readonly RankedCandidate[] | undefined): RankedCandidate | null {
  return list?.[0]?.level === "ok" ? list[0] : null;
}

export function PickList({
  list,
  add,
  selected,
  onPick,
}: {
  list: RankedCandidate[];
  add: number;
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  const pick = nectarPick(list);
  return (
    <div className="space-y-1.5">
      {list.slice(0, 8).map((c) => (
        <button
          key={c.staffId}
          type="button"
          disabled={c.level === "cant"}
          onClick={() => onPick(c.staffId)}
          aria-pressed={selected === c.staffId}
          className={`flex w-full items-center gap-2 rounded-md border p-2 text-left disabled:opacity-60
            ${selected === c.staffId ? "border-[var(--hive-gold)] bg-[var(--hive-gold-soft)]" : "border-[var(--hive-border)]"}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--hive-muted-surface)] text-xs font-bold">
            {initials(c.name)}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <b>{c.name}</b>
            {pick?.staffId === c.staffId && (
              <>
                {" "}
                <Pill tone="gold">Nectar's pick</Pill>
              </>
            )}
            <Why c={c} add={add} />
          </span>
          <Pill tone={TONE[c.level]}>{FIT_LABEL[c.level]}</Pill>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPick(null)}
        aria-pressed={selected === null}
        className={`flex w-full items-center gap-2 rounded-md border p-2 text-left
          ${selected === null ? "border-[var(--hive-gold)] bg-[var(--hive-gold-soft)]" : "border-[var(--hive-border)]"}`}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--hive-muted-surface)] text-xs font-bold">
          ?
        </span>
        <span className="flex-1 text-sm">
          <b>Leave it open</b>
          <span className="block text-xs text-[var(--hive-text-muted)]">
            Offer it to {list.filter(isQualified).length} qualified people
          </span>
        </span>
        <Pill tone="na">Open</Pill>
      </button>
    </div>
  );
}

export function AssignList({
  list,
  add,
  onAssign,
}: {
  list: RankedCandidate[];
  add: number;
  onAssign: (staffId: string, reason: string | null) => Promise<boolean>;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (id: string, r: string | null) => {
    setBusy(true);
    await onAssign(id, r);
    setBusy(false);
  };
  return (
    <div className="space-y-1.5">
      {list.map((c, i) => (
        <div
          key={c.staffId}
          className={`rounded-md border p-2 ${i === 0 && c.level === "ok" ? "border-[var(--hive-gold)]" : "border-[var(--hive-border)]"}`}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--hive-muted-surface)] text-xs font-bold">
              {initials(c.name)}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <b>{c.name}</b>
              <Why c={c} add={add} />
            </span>
            {c.evidenceHref && (
              <a href={c.evidenceHref} className="text-xs font-semibold underline">
                Evidence ›
              </a>
            )}
            {c.level === "cant" ? (
              <Pill tone="crit">Can't</Pill>
            ) : (
              <Button
                size="sm"
                className="min-h-11"
                variant={i === 0 ? "default" : "outline"}
                disabled={busy}
                onClick={() =>
                  c.level === "reason" ? setAsking(c.staffId) : void go(c.staffId, null)
                }
              >
                {c.level === "reason" ? "Assign with a reason" : "Assign"}
              </Button>
            )}
          </div>
          {asking === c.staffId && (
            <div className="mt-2 flex gap-2">
              <Input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                aria-label={`Why (required): ${c.reasons.join("; ")}`}
                placeholder="Why this works anyway (saved on the shift)"
              />
              <Button
                className="min-h-11"
                disabled={busy || reason.trim().length < 3}
                title={reason.trim().length < 3 ? "Type a reason first" : undefined}
                onClick={() => void go(c.staffId, reason.trim())}
              >
                Assign
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
