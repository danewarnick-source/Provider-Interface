// "Show hidden sections (N)" at the bottom of a profile section: the cards the
// setup answers hide, each with why, and (owners and agency admins with
// Clients edit) a button that turns it back on.

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { SCOPE_CARDS, showAgainAnswers, type ScopeCard } from "@/lib/clients/support-scope";
import { useNoPhoto } from "./use-no-photo";
import { useSaveSupportScope } from "./use-support-scope";

export function HiddenSections({
  orgId,
  clientId,
  cards,
}: {
  orgId: string;
  clientId: string;
  cards: readonly ScopeCard[];
}) {
  const { canCategory, isAgencyAdmin } = useAccess();
  const [open, setOpen] = useState(false);
  const save = useSaveSupportScope(orgId, clientId);
  const noPhoto = useNoPhoto(orgId, clientId);
  if (!cards.length || !(isAgencyAdmin && canCategory("clients", "edit"))) return null;
  const busy = save.isPending || noPhoto.isPending;
  const showAgain = (card: ScopeCard) =>
    card === "photo" ? noPhoto.mutate(false) : save.mutate({ answers: showAgainAnswers(card) });

  return (
    <div className="text-sm" data-testid="client-hidden-sections">
      <Button
        variant="link"
        className="h-11 px-0 text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <EyeOff className="mr-1.5 h-4 w-4" />
        {open ? "Hide this list" : `Show hidden sections (${cards.length})`}
      </Button>
      {open ? (
        <ul className="mt-1 space-y-2 rounded-xl border border-hive-border bg-hive-surface p-3">
          {cards.map((card) => (
            <li key={card} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium text-hive-ink">{SCOPE_CARDS[card].label}</span>
                <span className="text-muted-foreground"> · {SCOPE_CARDS[card].why}</span>
              </span>
              <Button
                variant="outline"
                className="max-md:min-h-11"
                disabled={busy}
                onClick={() => showAgain(card)}
              >
                Show {SCOPE_CARDS[card].label.toLowerCase()}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
