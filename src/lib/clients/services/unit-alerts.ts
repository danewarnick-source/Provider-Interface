// "Email coordinator" on an authorization card whose units run out before the
// end date (authorizations.ts runsOutOn). PI sends nothing: a mailto: link
// opens the user's own email app, then "I sent it" records who and when
// (client_unit_alerts, one live record per authorization row; Undo is a soft
// void). A record for an older row (e.g. before a renewal) never shows.
// Pure (no Supabase), node --test.

import { isAdminLevel } from "../../access/levels.ts";
import { formatDate } from "../dates.ts";

export const UNIT_ALERT_NOT_ALLOWED = "Only Owners and Admins with Billing edit can record this.";

/** Who may record "I sent it" (or Undo it): Owners, and Admins with Billing: Edit. */
export function canRecordUnitAlert(level: string | null | undefined, billingEdit: boolean): boolean {
  return isAdminLevel(level) && billingEdit;
}

/** A live (not voided) "coordinator emailed" record. */
export type UnitAlert = {
  id: string;
  billingCodeId: string;
  /** Who recorded it (name). */
  by: string | null;
  /** YYYY-MM-DD (Denver). */
  on: string;
};

export type CoordinatorEmailInput = {
  clientName: string;
  code: string;
  used: number;
  total: number;
  /** "units" or "days". */
  unitWord: string;
  /** YYYY-MM-DD the units run out at the current pace. */
  runsOutOn: string;
};

const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** Subject and plain-text body. Only the code, units and run-out date; nothing else about the client. */
export function coordinatorEmail(input: CoordinatorEmailInput): { subject: string; body: string } {
  const code = input.code.trim();
  return {
    subject: `${input.clientName.trim()}: ${code} units`,
    body: [
      `${num(input.used)} of ${num(input.total)} ${input.unitWord} used.`,
      `At this pace they run out ${formatDate(input.runsOutOn)}.`,
      "",
      "Can we talk about adjusting the PCSP?",
    ].join("\r\n"),
  };
}

/** mailto: link to the coordinator with the subject and body encoded. */
export function coordinatorMailto(email: string, input: CoordinatorEmailInput): string {
  const { subject, body } = coordinatorEmail(input);
  const to = encodeURIComponent(email.trim()).replace(/%40/g, "@");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type UnitAlertState =
  | { kind: "hidden" }
  | { kind: "add_email" }
  | { kind: "email"; email: string }
  | { kind: "confirm"; email: string }
  | { kind: "recorded"; alert: UnitAlert };

/**
 * What the card shows: nothing unless the run-out warning shows; the record
 * once "I sent it" is ticked; otherwise the Contacts link (no coordinator
 * email), the "I sent it" checkbox (after the button was clicked), or the
 * Email coordinator button. Anyone who can't record it (canRecordUnitAlert)
 * only sees a record.
 */
export function unitAlertState(input: {
  warning: boolean;
  billingCodeId: string;
  alerts: readonly UnitAlert[];
  coordinatorEmail: string | null | undefined;
  clicked: boolean;
  canEdit: boolean;
}): UnitAlertState {
  if (!input.warning) return { kind: "hidden" };
  const alert = input.alerts.find((a) => a.billingCodeId === input.billingCodeId);
  if (alert) return { kind: "recorded", alert };
  if (!input.canEdit) return { kind: "hidden" };
  const email = input.coordinatorEmail?.trim();
  if (!email) return { kind: "add_email" };
  return input.clicked ? { kind: "confirm", email } : { kind: "email", email };
}

/** "✓ Coordinator emailed by Dane Warnick, Oct 8, 2026". */
export function unitAlertLine(alert: UnitAlert): string {
  return `✓ Coordinator emailed${alert.by ? ` by ${alert.by}` : ""}, ${formatDate(alert.on)}`;
}
