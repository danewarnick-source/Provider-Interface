// One Needs you row (B5): its tag, where and when, why, and its fix buttons
// (the plan's behavior table). Drawers (Find staff, the overtime list) are the
// board's, opened through the board context the page provides; the other
// buttons are useNeedsActions; the escalation line and Start / Stop
// escalation are EscalationControls. A button the viewer can't use is
// disabled and says why underneath.
import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NEED_TAG, type NeedItem } from "@/lib/scheduler/needs-items";
import { firstName, useBoard } from "@/components/scheduler/board/board-context";
import { EscalationControls } from "./escalation-controls";
import type { NeedsActions } from "./use-needs-actions";

const TAG_COLOR = {
  crit: "text-[var(--hive-danger)]",
  warn: "text-[var(--hive-gold)]",
  info: "text-[var(--hive-info)]",
} as const;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

type Act = { label: string; onClick: () => void; off?: string | null };

function Actions({ acts, busy }: { acts: Act[]; busy: boolean }) {
  const reasons = [...new Set(acts.map((a) => a.off).filter(Boolean))];
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {acts.map((a, n) => {
          const variant = n === 0 ? "default" : "outline";
          return (
            <Button
              key={a.label}
              variant={variant}
              className="min-h-11"
              disabled={busy || !!a.off}
              title={a.off ?? undefined}
              onClick={(e) => {
                e.stopPropagation();
                a.onClick();
              }}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
      {reasons.map((r) => (
        <p key={r} className="text-xs text-[var(--hive-text-muted)]">
          {r}
        </p>
      ))}
    </div>
  );
}

export function NeedsRow({ item: i, act }: { item: NeedItem; act: NeedsActions }) {
  const b = useBoard();
  const nav = useNavigate();
  const [phone, setPhone] = useState(false);
  const loaded = !!i.shiftId && b.shifts.some((s) => s.id === i.shiftId);
  const shift = b.shifts.find((s) => s.id === i.shiftId);
  const edit = b.canEdit ? null : "Needs Scheduling edit access.";
  const who = firstName(i.staffId ? (b.staff.get(i.staffId)?.name ?? "them") : "them");
  const find = (label: string): Act => ({
    label,
    onClick: () => b.open({ kind: "find", id: i.shiftId! }),
    off: edit ?? (loaded ? null : "Open it from the board for that week."),
  });
  const call: Act = { label: `Call ${who}`, onClick: () => setPhone(true) };
  const askPunch: Act = {
    label: i.askedAt ? `Asked at ${clock(i.askedAt)}` : "Ask them to fix their punch",
    onClick: () => act.askPunch(i.key, i.shiftId!, who),
    off:
      edit ?? (i.askedAt ? `Asked at ${clock(i.askedAt)}. They get one notice per shift.` : null),
  };
  const decide = i.approve && !i.approve.ok ? i.approve.reason : null;

  const acts: Record<NeedItem["kind"], Act[]> = {
    callout: [
      find("Find staff"),
      { label: "Done", onClick: () => act.done(i.key, i.refId!), off: edit },
    ],
    late: [call, find("Find cover"), askPunch],
    missed: [
      call,
      askPunch,
      { label: "Didn't happen", onClick: () => act.didntHappen(i.key, i.shiftId!), off: edit },
    ],
    open: [
      find("Find staff"),
      {
        label: i.offered ? "Offer again" : "Offer",
        onClick: () => void b.actions.offer([i.shiftId!]),
        off: edit,
      },
    ],
    one_to_one: [],
    claim: [
      { label: "Approve", onClick: () => act.claim(i.key, i.shiftId!, true), off: decide },
      { label: "Not this time", onClick: () => act.claim(i.key, i.shiftId!, false), off: decide },
    ],
    swap: [
      { label: "Approve swap", onClick: () => act.swapOk(i.key, i.refId!), off: decide },
      { label: "Deny", onClick: () => act.swapNo(i.key, i.refId!), off: decide },
    ],
    timeoff: [
      { label: "Approve", onClick: () => act.timeOff(i.key, i.refId!, true), off: decide },
      { label: "Not approved", onClick: () => act.timeOff(i.key, i.refId!, false), off: decide },
    ],
    uncovered: [
      {
        label: "Make it open",
        onClick: () => shift && void b.actions.makeOpen(shift),
        off: edit ?? (shift ? null : "Open it from the board for that week."),
      },
      find("Find staff"),
    ],
    punch_fix: [
      { label: "Approve fix", onClick: () => act.approveFix(i.key, i.refId!), off: decide },
      { label: "Ask for more detail", onClick: () => act.moreDetail(i.key, i.refId!), off: decide },
    ],
    card_expired: [],
    card_expiring: [],
    auth: [
      {
        label: "See authorizations",
        onClick: () => void nav({ to: "/dashboard/scheduler", search: { view: "clients" } }),
      },
    ],
    overtime: [{ label: "See their shifts", onClick: () => b.open({ kind: "list", which: "ot" }) }],
  };
  acts.one_to_one = acts.open;
  const card: Act[] = [
    ...(i.href ? [{ label: "Open in Evidence", onClick: () => void nav({ href: i.href! }) }] : []),
    {
      label: i.askedAt ? `Reminded at ${clock(i.askedAt)}` : "Send a reminder",
      onClick: () => act.remind(i.key, i.staffId!, i.cardLabel ?? "card"),
      off: edit ?? (i.askedAt ? "One reminder a day." : null),
    },
  ];
  acts.card_expired = card;
  acts.card_expiring = card;

  return (
    <Row
      onOpen={loaded ? () => b.open({ kind: "shift", id: i.shiftId! }) : undefined}
      tag={
        <span
          className={`text-[10.5px] font-extrabold uppercase tracking-wider ${TAG_COLOR[i.level]}`}
        >
          {NEED_TAG[i.kind]}
        </span>
      }
      title={i.title}
      why={i.why}
    >
      <Actions acts={acts[i.kind]} busy={act.busy === i.key} />
      <EscalationControls item={i} act={act} canEdit={b.canEdit} />
      {phone && (
        <p className="select-all text-sm font-semibold" onClick={(e) => e.stopPropagation()}>
          {i.phone ?? `No phone on file for ${who}.`}
        </p>
      )}
    </Row>
  );
}

function Row({
  tag,
  title,
  why,
  onOpen,
  children,
}: {
  tag: ReactNode;
  title: string;
  why: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  return (
    <li
      onClick={onOpen}
      className={`grid gap-2 border-t border-[var(--hive-border)] px-4 py-3 first:border-t-0 md:grid-cols-[140px_1fr_1fr_minmax(260px,auto)] md:items-start ${onOpen ? "cursor-pointer hover:bg-[var(--hive-hover)]" : ""}`}
    >
      <div>{tag}</div>
      <b className="text-sm">{title}</b>
      <p className="text-sm text-[var(--hive-text-muted)]">{why}</p>
      <div className="space-y-2">{children}</div>
    </li>
  );
}
