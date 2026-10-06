// Needs-attention cards on the client Overview (from lib/clients/readiness.ts).
// Each card opens the section that fixes it.

import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CLIENT_SECTION_LABEL, type ClientProfileSection } from "@/lib/clients/profile-sections";
import type { AttentionItem } from "@/lib/clients/readiness";

const TONE: Record<AttentionItem["tone"], string> = {
  bad: "border-destructive/30 bg-destructive/5",
  warn: "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5",
};
const ICON: Record<AttentionItem["tone"], string> = {
  bad: "text-destructive",
  warn: "text-amber-600 dark:text-amber-300",
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
      <Card data-testid="client-attention-clear">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing needs attention right now.
        </CardContent>
      </Card>
    );
  }
  return (
    <section aria-label="Needs attention" data-testid="client-attention">
      <h2 className="mb-2 text-sm font-semibold">
        {items.length} {items.length === 1 ? "thing needs" : "things need"} attention
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              onClick={() => onSelect(a.section)}
              className={cn(
                "flex h-full w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60",
                TONE[a.tone],
              )}
              data-testid="client-attention-card"
            >
              <CircleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", ICON[a.tone])} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.title}</span>
                <span className="block text-xs text-muted-foreground">{a.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                {CLIENT_SECTION_LABEL[a.section]} <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
