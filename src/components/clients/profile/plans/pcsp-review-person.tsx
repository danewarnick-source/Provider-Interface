// Profile details and the support coordinator from the PCSP. Blank profile
// fields are filled on confirm; what's already on the profile is kept.
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReviewedPcsp } from "@/lib/clients/pcsp/review";
import type { ReviewEdit } from "./pcsp-review";

type TextKey = "pid" | "phone" | "address";

export function PcspReviewPerson({ review, edit }: { review: ReviewedPcsp; edit: ReviewEdit }) {
  const { person } = review;
  const sc = person.supportCoordinator;
  const field = (key: TextKey, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`pcsp-person-${key}`} className="text-xs">{label}</Label>
      <Input
        id={`pcsp-person-${key}`} className="h-9" value={person[key]}
        onChange={(e) => edit((d) => { d.person[key] = e.target.value; })}
      />
    </div>
  );
  return (
    <section className="space-y-2" data-testid="pcsp-review-person">
      <h3 className="text-sm font-semibold">Profile</h3>
      <p className="text-xs text-muted-foreground">Fills only what's blank on the profile; anything already there is kept.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {field("pid", "DSPD PID")}
        <div className="space-y-1">
          <Label htmlFor="pcsp-person-dob" className="text-xs">Date of birth</Label>
          <Input
            id="pcsp-person-dob" type="date" className="h-9" value={person.dob ?? ""}
            onChange={(e) => edit((d) => { d.person.dob = e.target.value || null; })}
          />
        </div>
        {field("phone", "Phone")}
        {field("address", "Address")}
      </div>
      {sc.name.trim() ? (
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5" checked={sc.include}
            onCheckedChange={(v) => edit((d) => { d.person.supportCoordinator.include = v === true; })}
          />
          <span>
            Add support coordinator {sc.name}
            {[sc.company, sc.phone, sc.email].filter(Boolean).length ? ` (${[sc.company, sc.phone, sc.email].filter(Boolean).join(" · ")})` : ""}
            <span className="block text-xs text-muted-foreground">Skipped if they're already a contact.</span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">No support coordinator was found in the PCSP.</p>
      )}
    </section>
  );
}
