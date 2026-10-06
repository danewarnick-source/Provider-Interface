export type ClientListRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  physical_address: string | null;
  pcsp_goals: string[];
  job_code: string[];
  authorized_dspd_codes: string[];
  medicaid_id: string | null;
  account_status: string | null;
  geofence_radius_feet: number | null;
  special_directions: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  // Guardianship — when is_own_guardian = true, the other guardian_* fields
  // must be empty. See `validate_client_guardianship` trigger.
  is_own_guardian: boolean | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  guardian_email: string | null;
  // feature toggles stored as JSON
  feature_config: Record<string, boolean> | null;
  profile_photo_url: string | null;
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
