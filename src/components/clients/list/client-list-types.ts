import type { ClientListRow } from "@/lib/clients/list";
import type { ListViewer } from "@/lib/clients/list-display";

/** Shared row props for the phone cards and the desktop table. */
export type ClientListViewProps = {
  rows: ClientListRow[];
  discharged: boolean;
  canEditClients: boolean;
  /** What the viewer may open and edit, for the empty-cell shortcuts. */
  viewer: ListViewer;
  reactivate: {
    isPending: boolean;
    variables: string | undefined;
    mutate: (clientId: string) => void;
  };
  onOpenClient: (clientId: string) => void;
};

/** Row clicks open the client unless the click landed on a control. */
export function isRowControlClick(target: EventTarget): boolean {
  const t = target as HTMLElement;
  return !!t.closest(
    'a,button,input,select,textarea,[role="menuitem"],[role="menu"],[data-no-row-nav]',
  );
}
