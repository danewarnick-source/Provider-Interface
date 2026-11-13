// The home's lead, called "Host" on a host home (teams.manager_id). This is the
// one record of who leads a home and, on a host home, who the residents live
// with: Clients, Daily Logs and Finances read it from here. Used by the home page.
import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { leadLabel } from "@/lib/homes/home-kind";

type Person = { id: string; name: string };

export function HomeLeadField(props: {
  teamType: string | null;
  leadId: string | null;
  /** Active team members. */
  people: readonly Person[];
  /** First names of the clients who live here, for the remove warning. */
  residentNames: readonly string[];
  saving: boolean;
  onSave: (leadId: string | null) => void;
}) {
  const label = leadLabel(props.teamType);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // "+ Set host" links elsewhere open this page at #lead.
  useEffect(() => {
    if (window.location.hash === "#lead") {
      triggerRef.current?.focus();
    }
  }, []);

  const lead = props.people.find((p) => p.id === props.leadId);
  const noPeople = props.people.length === 0;
  const isHost = label === "Host";

  return (
    <div>
      <Label htmlFor="home-lead">{label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Select
          value={props.leadId ?? ""}
          disabled={noPeople || props.saving}
          onValueChange={(v) => props.onSave(v || null)}
        >
          <SelectTrigger
            id="home-lead"
            ref={triggerRef}
            className="min-w-[220px] flex-1"
            title={noPeople ? `Add the ${label.toLowerCase()} as a team member first` : undefined}
          >
            <SelectValue placeholder={isHost ? "Pick the host" : "Pick the lead"} />
          </SelectTrigger>
          <SelectContent>
            {props.people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {props.leadId && (
          <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)}>
            Remove {label.toLowerCase()}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {noPeople
          ? `Add the ${label.toLowerCase()} as a team member first.`
          : isHost
            ? "The host family member the residents live with. Daily Logs and Finances use this."
            : "Approves this home's swaps and fixes, and reviews its notes."}
        {props.leadId && !lead ? " The saved person is no longer an active team member." : ""}
      </p>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the {label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isHost && props.residentNames.length
                ? `${props.residentNames.join(", ")} will have no host on record. Missing daily notes go back to the client until you pick a new host.`
                : `This home will have no ${label.toLowerCase()} until you pick one.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep {lead ? lead.name : `the ${label.toLowerCase()}`}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                props.onSave(null);
                setConfirmRemove(false);
              }}
            >
              Remove {label.toLowerCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
