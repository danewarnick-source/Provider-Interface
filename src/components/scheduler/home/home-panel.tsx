// The card every home page section sits in: a title, one line on what it's
// for, an optional action at the top right, then the body.
import type { ReactNode } from "react";

export function HomePanel({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--hive-border)] bg-[var(--hive-surface)]">
      <div className="flex flex-col gap-2 border-b border-[var(--hive-border)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-[var(--hive-text-muted)]">{sub}</p>
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}
