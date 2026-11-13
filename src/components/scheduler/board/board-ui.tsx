// Small shared pieces for the scheduler board: status pills, the service-code
// tag, and the right-hand drawer every board panel opens in (shift, Add shift,
// Find staff, the stat-tile lists). A drawer with unsaved changes asks before
// it closes.
import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { classesForCode } from "@/lib/scheduler/code-colors";

export type Tone = "ok" | "warn" | "crit" | "info" | "na" | "gold";

const TONES: Record<Tone, string> = {
  ok: "bg-[var(--hive-ok-soft)] text-[var(--hive-ok)]",
  warn: "bg-[var(--hive-gold-soft)] text-[var(--hive-text)]",
  gold: "bg-[var(--hive-gold-soft)] text-[var(--hive-text)] ring-1 ring-[var(--hive-gold)]",
  crit: "bg-[var(--hive-danger-soft)] text-[var(--hive-danger)]",
  info: "bg-[var(--hive-muted-surface)] text-[var(--hive-info)]",
  na: "bg-[var(--hive-muted-surface)] text-[var(--hive-text-muted)]",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function CodeTag({ code }: { code: string | null }) {
  const c = classesForCode(code);
  return (
    <span className={`rounded px-1 text-[10px] font-bold ${c.bgSoft} ${c.text}`}>
      {(code ?? "").toUpperCase()}
    </span>
  );
}

export function DrawerShell({
  open,
  onClose,
  kicker,
  title,
  children,
  footer,
  dirty = false,
}: {
  open: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dirty?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-[var(--hive-border)] px-5 py-4 text-left">
          <SheetDescription className="text-xs font-semibold uppercase tracking-wide">
            {kicker}
          </SheetDescription>
          <SheetTitle className="text-lg">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hive-border)] px-5 py-3">
            <span className="flex-1 text-sm">Close without saving this shift?</span>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                setConfirming(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </div>
        ) : (
          footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--hive-border)] px-5 py-3">
              {footer}
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
