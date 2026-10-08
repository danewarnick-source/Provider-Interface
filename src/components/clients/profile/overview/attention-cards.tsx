// Needs attention on the client Overview (from lib/clients/readiness.ts):
// one "Needs attention (N)" button, collapsed by default, that opens the
// list. Each item opens the section that fixes it. Open/closed is remembered
// per viewer in this browser only.

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_TAG } from "@/components/profile-shell/tones";
import { CLIENT_SECTION_LABEL, type ClientProfileSection } from "@/lib/clients/profile-sections";
import { attentionSummary } from "@/lib/clients/overview";
import type { AttentionItem } from "@/lib/clients/readiness";

const OPEN_KEY = "client-overview-attention-open";

const ITEM_TONE: Record<AttentionItem["tone"], string> = {
  bad: "border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)]",
  warn: "border-hive-gold/50 bg-hive-gold-soft",
};
const ICON: Record<AttentionItem["tone"], string> = {
  bad: "text-[var(--hive-danger-fg)]",
  warn: "text-hive-ink",
};

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // Storage blocked (private window): the list just starts collapsed.
  }
}

export function AttentionCards({
  items,
  loading,
  onSelect,
}: {
  items: AttentionItem[];
  loading: boolean;
  onSelect: (section: ClientProfileSection) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(readOpen()), []);
  const summary = attentionSummary(items);
  if (loading || !summary) return null;
  const toggle = () => {
    writeOpen(!open);
    setOpen(!open);
  };
  return (
    <div data-testid="client-attention">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="client-attention-list"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
          TONE_TAG[summary.tone],
        )}
        data-testid="client-attention-toggle"
      >
        <CircleAlert className="h-4 w-4" aria-hidden />
        Needs attention ({summary.count})
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id="client-attention-list"
          className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Needs attention"
        >
          {items.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                onClick={() => onSelect(a.section)}
                className={cn(
                  "flex h-full min-h-11 w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors hover:brightness-[0.98]",
                  ITEM_TONE[a.tone],
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
      ) : null}
    </div>
  );
}
