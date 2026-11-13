// Shared pieces for the Scheduling settings tabs: the settings context (data,
// who may edit, one save helper that toasts what was saved), a segmented
// choice, a labelled row and a panel. Used by every tab and the home card.
import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TONE_TAG, type ProfileTone } from "@/components/profile-shell/tones";
import type { SchedulingSettingsData } from "@/lib/scheduler/settings/settings.functions";
import { READ_ONLY_REASON } from "./settings-format";

type Ctx = {
  orgId: string;
  data: SchedulingSettingsData;
  canEdit: boolean;
  /** Runs one save, toasts `saved` ("Overtime: 44 h a week saved") and reloads the settings. */
  save: (work: () => Promise<unknown>, saved: string) => Promise<boolean>;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({
  orgId,
  data,
  children,
}: {
  orgId: string;
  data: SchedulingSettingsData;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const save: Ctx["save"] = async (work, saved) => {
    try {
      await work();
      toast.success(saved);
      await qc.invalidateQueries({ queryKey: ["scheduling-settings", orgId] });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That setting didn't save. Try again.");
      return false;
    }
  };
  return (
    <SettingsContext.Provider value={{ orgId, data, canEdit: data.canEdit, save }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings needs a SettingsProvider");
  return ctx;
}

export type Choice<T> = { value: T; label: string; disabled?: boolean; reason?: string };

/** A row of pressable choices; the pressed one is the current value. */
export function Segmented<T extends string | number | boolean | null>({
  label,
  value,
  choices,
  onPick,
  readOnly,
}: {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onPick: (v: T) => void;
  readOnly?: boolean;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      title={readOnly ? READ_ONLY_REASON : undefined}
      className="inline-flex flex-wrap overflow-hidden rounded-lg border border-[var(--hive-border)]"
    >
      {choices.map((c) => (
        <button
          key={String(c.value)}
          type="button"
          aria-pressed={c.value === value}
          disabled={readOnly || c.disabled}
          title={c.disabled ? c.reason : undefined}
          onClick={() => c.value !== value && onPick(c.value)}
          className={cn(
            "min-h-11 px-3 text-[13px] font-semibold disabled:cursor-not-allowed",
            c.value === value
              ? "bg-[var(--hive-gold-soft)] text-[var(--hive-text)]"
              : "bg-transparent text-muted-foreground",
            c.disabled && "opacity-50",
          )}
        >
          {c.label}
        </button>
      ))}
    </span>
  );
}

export function SettingRow({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--hive-border)] py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-[52ch]">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Panel({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--hive-border)] bg-[var(--hive-surface)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--hive-border)] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

/** A small pill in the existing tone tokens (profile-shell/tones.ts). */
export function Tag({ tone, children }: { tone: ProfileTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_TAG[tone],
      )}
    >
      {children}
    </span>
  );
}
