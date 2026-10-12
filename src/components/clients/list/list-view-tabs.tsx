export type PageView = "active" | "discharged" | "referrals";

/** Active / Discharged tabs, plus a small Referrals link when the org has referrals. */
export function ListViewTabs({
  view,
  onChange,
  counts,
  showReferrals,
}: {
  view: PageView;
  onChange: (v: PageView) => void;
  counts: { active: number; discharged: number } | undefined;
  showReferrals: boolean;
}) {
  const tabs: Array<{ key: "active" | "discharged"; label: string }> = [
    { key: "active", label: "Active" },
    { key: "discharged", label: "Discharged" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            onClick={() => onChange(t.key)}
            className={
              "min-h-8 rounded px-3 py-1 font-medium transition-colors max-md:min-h-11 " +
              (view === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
            {counts && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>
      {showReferrals && (
        <button
          type="button"
          onClick={() => onChange(view === "referrals" ? "active" : "referrals")}
          className={`min-h-8 text-xs font-medium underline-offset-2 max-md:min-h-11 hover:underline ${view === "referrals" ? "text-foreground" : "text-primary"}`}
        >
          {view === "referrals" ? "← Back to clients" : "Show referrals"}
        </button>
      )}
    </div>
  );
}
