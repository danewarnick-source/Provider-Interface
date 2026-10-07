// The one card every client profile section uses ("soft panel" look): an
// icon tile tinted by tone, title, one-line description, actions on the
// right. Plus the pencil edit button and the Cancel/Save bar for cards that
// edit in place.

import type { ReactNode } from "react";
import { Pencil, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_TILE, type ProfileTone } from "@/components/profile-shell/tones";

export type CardTone = ProfileTone;

export function SectionCard({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  actions,
  children,
  id,
  className,
  testId,
}: {
  icon: LucideIcon;
  tone?: CardTone;
  title: ReactNode;
  /** One line: what this card is for. */
  description: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Scroll target. */
  id?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 rounded-2xl border border-hive-border bg-hive-surface p-5 md:p-6",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden
          className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", TONE_TILE[tone])}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <h3 className="text-lg font-semibold leading-tight text-hive-ink">{title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 max-md:[&_a]:min-h-11 max-md:[&_button]:min-h-11">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-5 min-w-0">{children}</div> : null}
    </section>
  );
}

/** 40 px square pencil (44 px on phones). Label it: "Edit identity". */
export function EditButton({
  label,
  onClick,
  testId,
}: {
  label: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10 max-md:h-11 max-md:w-11"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-testid={testId}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );
}

/** Cancel + save for a card in edit mode. */
export function SaveBar({
  onCancel,
  onSave,
  saving,
  saveLabel = "Save changes",
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-hive-border pt-4 max-md:[&_button]:min-h-11">
      <Button variant="outline" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={saving || disabled}>
        {saving ? "Saving…" : saveLabel}
      </Button>
    </div>
  );
}
