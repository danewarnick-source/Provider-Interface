export type ClientListRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  physical_address: string | null;
  /** Active service codes (client_billing_codes). */
  codes: string[];
  medicaid_id: string | null;
  account_status: string | null;
  intake_status: string | null;
};

export type RosterTab = "active" | "archived";

/** Shared row props for the mobile card list and the desktop table. */
export type ClientListViewProps = {
  rows: ClientListRow[];
  rosterTab: RosterTab;
  organizationId: string | undefined;
  canEditClients: boolean;
  reactivate: {
    isPending: boolean;
    variables: string | undefined;
    mutate: (clientId: string) => void;
  };
  onOpenClient: (clientId: string) => void;
  onOpenIntake: (client: { id: string; name: string }) => void;
};

/** Row clicks open the client unless the click landed on a control. */
export function isRowControlClick(target: EventTarget): boolean {
  const t = target as HTMLElement;
  return !!t.closest('a,button,input,select,textarea,[role="menuitem"],[role="menu"],[data-no-row-nav]');
}

export function clientFullName(c: Pick<ClientListRow, "first_name" | "last_name">): string {
  return `${c.first_name} ${c.last_name}`.trim();
}
