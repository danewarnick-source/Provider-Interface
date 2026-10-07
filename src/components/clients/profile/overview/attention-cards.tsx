// Needs-attention cards on the client Overview (from lib/clients/readiness.ts).
// Each card opens the section that fixes it.

import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { CLIENT_SECTION_LABEL, type ClientProfileSection } from "@/lib/clients/profile-sections";
import type { AttentionItem } from "@/lib/clients/readiness";

const TONE: Record<AttentionItem["tone"], string> = {
  bad: "border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)]",
  warn: "border-hive-gold/50 bg-hive-gold-soft",
};
const ICON: Record<AttentionItem["tone"], string> = {
  bad: "text-[var(--hive-danger-fg)]",
  warn: "text-hive-ink",
};

export function AttentionCards({
  items,
  loading,
  onSelect,
}: {
  items: AttentionItem[];
  loading: boolean;
  onSelect: (section: ClientProfileSection) => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Checking what needs attention…</p>;
  }
  if (!items.length) {
    return (
      <SectionCard
        icon={CheckCircle2}
        tone="ok"
        title="Nothing needs attention"
        description="Setup, plans, units and the client file are all up to date."
        testId="client-attention-clear"
      />
    );
  }
  return (
    <SectionCard
      icon={CircleAlert}
      tone="danger"
      title={`${items.length} ${items.length === 1 ? "thing needs" : "things need"} attention`}
      description="Each item opens the section that fixes it."
      testId="client-attention"
    >
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Needs attention">
        {items.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              onClick={() => onSelect(a.section)}
              className={cn(
                "flex h-full min-h-11 w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors hover:brightness-[0.98]",
                TONE[a.tone],
              )}
              data-testid="client-attention-card"
            >
              <CircleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", ICON[a.tone])} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-hive-ink">{a.title}</span>
                <span className="block text-xs text-muted-foreground">{a.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                Open {CLIENT_SECTION_LABEL[a.section]}{" "}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
