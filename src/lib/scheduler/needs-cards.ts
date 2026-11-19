// Cards expiring or expired, for Needs you (B5). Pure. A card shows when the
// person has shifts after its expiry date and the card expires within
// CARD_SOON_DAYS (or already has). What a shift needs and whether a card
// counts on its date is qualificationsOnDate (rules-qualifications.ts): a
// shift after the expiry reads "expired" there, with the expiry date and the
// Evidence link. Called by needs-list.ts through the loader in needs.server.ts.
import { qualificationsOnDate } from "./rules-qualifications.ts";
import type { QualEvidence, StaffFacts } from "./rules-types.ts";
import { addDaysKey } from "./time.ts";

export const CARD_SOON_DAYS = 14;

export type CardFinding = {
  staffId: string;
  key: string;
  label: string;
  expiresOn: string;
  expired: boolean;
  /** Live shifts of theirs after the expiry date. */
  shiftsAfter: number;
  href: string | null;
};

export function cardFindings(
  people: readonly StaffFacts[],
  shifts: ReadonlyArray<{
    staff_id: string | null;
    service_code: string | null;
    starts_at: string;
  }>,
  evidence: Readonly<Record<string, QualEvidence>>,
  today: string,
): CardFinding[] {
  const soon = addDaysKey(today, CARD_SOON_DAYS);
  const found = new Map<string, CardFinding>();
  for (const person of people) {
    for (const s of shifts) {
      if (s.staff_id !== person.id) continue;
      const results = qualificationsOnDate(
        person,
        { code: s.service_code ?? "", startsAt: s.starts_at },
        evidence[person.id],
      );
      for (const r of results) {
        if (r.state !== "expired" || !r.expiresOn || r.expiresOn > soon) continue;
        const key = `${person.id}:${r.key}`;
        const cur = found.get(key);
        if (cur) cur.shiftsAfter += 1;
        else
          found.set(key, {
            staffId: person.id,
            key: r.key,
            label: r.label,
            expiresOn: r.expiresOn,
            expired: r.expiresOn < today,
            shiftsAfter: 1,
            href: r.fix?.href ?? null,
          });
      }
    }
  }
  return [...found.values()];
}
