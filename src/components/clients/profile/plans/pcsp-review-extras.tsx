// Other agencies' risk/behavior/nursing providers (→ contacts).
// Each row can be left out.
import { Checkbox } from "@/components/ui/checkbox";
import type { ReviewedPcsp } from "@/lib/clients/pcsp/review";
import type { ReviewEdit } from "./pcsp-review";

type ListKey = "otherProviders";

export function PcspReviewExtras({ review, edit }: { review: ReviewedPcsp; edit: ReviewEdit }) {
  const group = (key: ListKey, title: string, where: string, line: (i: number) => string) => (
    <div className="space-y-1">
      <p className="text-xs font-medium">{title} <span className="font-normal text-muted-foreground">→ {where}</span></p>
      {review[key].length === 0 ? (
        <p className="text-xs text-muted-foreground">None found.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {review[key].map((row, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Checkbox
                className="mt-0.5" checked={row.include} aria-label={`Keep: ${line(i).slice(0, 40)}`}
                onCheckedChange={(v) => edit((d) => { d[key][i].include = v === true; })}
              />
              <span>{line(i)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Also from the PCSP</h3>
      {group("otherProviders", "Other providers", "Contacts", (i) => {
        const p = review.otherProviders[i];
        return `${p.provider} (${p.code})${p.note ? ` — ${p.note}` : ""}`;
      })}
    </section>
  );
}
