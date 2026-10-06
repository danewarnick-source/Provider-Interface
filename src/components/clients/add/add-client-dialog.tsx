import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DspdCodesMultiSelect } from "./dspd-codes-multiselect";

export type AddClientValues = {
  first_name: string;
  last_name: string;
  phone_number: string;
  physical_address: string;
  /** Service codes picked here become $0 authorization rows (client_billing_codes). */
  codes: string[];
  medicaid_id: string;
  geofence_radius_feet: number;
  is_own_guardian: boolean;
  /** Required when the client is not their own guardian; saved to client_contacts. */
  guardian: { name: string; phone: string; relationship: string; email: string } | null;
  intake_mode: "intake" | "profile-only";
};

const GEOFENCE_OPTIONS = [
  { v: 250,  l: "250 ft — Strict In-Home" },
  { v: 500,  l: "500 ft — Standard Suburban" },
  { v: 1000, l: "1,000 ft — Medicaid Baseline" },
  { v: 2500, l: "2,500 ft — Community Outing" },
  { v: 5000, l: "5,000 ft — Rural / Open Campus" },
];

/** Quick-add client dialog (not the full workspace). Rendered inside a <Dialog>. */
export function AddClientDialog({
  pending, onSubmit,
}: { pending: boolean; onSubmit: (v: AddClientValues) => void }) {
  const [mode, setMode] = useState<"intake" | "profile-only" | null>(null);
  const [first, setFirst]         = useState("");
  const [last, setLast]           = useState("");
  const [phone, setPhone]         = useState("");
  const [addr, setAddr]           = useState("");
  const [medicaidId, setMedicaidId] = useState("");
  const [jobCodes, setJobCodes]   = useState<string[]>([]);
  const [codesMenuOpen, setCodesMenuOpen] = useState(false);
  const [radius, setRadius]       = useState(1000);
  const [isOwnGuardian, setIsOwnGuardian] = useState(true);
  const [gName, setGName]         = useState("");
  const [gPhone, setGPhone]       = useState("");
  const [gRel, setGRel]           = useState("");
  const [gEmail, setGEmail]       = useState("");

  const guardianInvalid = !isOwnGuardian && (!gName.trim() || !gPhone.trim());

  function missingRequiredMessage(): string | null {
    const missing: string[] = [];
    if (!first.trim()) missing.push("first name");
    if (!last.trim()) missing.push("last name");
    if (!medicaidId.trim()) missing.push("Medicaid ID");
    if (!addr.trim()) missing.push("service address");
    if (jobCodes.length === 0) missing.push("at least one DSPD billing code");
    if (guardianInvalid) missing.push("guardian name and phone");
    if (missing.length === 0) return null;
    return `Please complete: ${missing.join(", ")}.`;
  }

  function submit() {
    const msg = missingRequiredMessage();
    if (msg) {
      toast.error(msg);
      return;
    }
    onSubmit({
      first_name: first.trim(), last_name: last.trim(),
      phone_number: phone.trim(), physical_address: addr.trim(),
      codes: jobCodes,
      medicaid_id: medicaidId.trim(), geofence_radius_feet: radius,
      is_own_guardian: isOwnGuardian,
      guardian: isOwnGuardian
        ? null
        : { name: gName.trim(), phone: gPhone.trim(), relationship: gRel.trim(), email: gEmail.trim() },
      intake_mode: mode!,
    });
  }

  if (!mode) {
    return (
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            How do you want to proceed?
          </p>
          <button
            type="button"
            onClick={() => setMode("intake")}
            className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <div className="font-semibold">Create profile &amp; begin intake now</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Create the client profile and immediately start the new-client intake procedure.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("profile-only")}
            className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <div className="font-semibold">Create as draft — finish later</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Saves an incomplete client profile (intake not started). It will show as <strong>Needs review</strong> in the directory until you finalize it.
            </p>
          </button>
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent
      className="max-h-[90vh] overflow-y-auto max-w-lg"
      onEscapeKeyDown={(e) => {
        if (codesMenuOpen) {
          e.preventDefault();
          setCodesMenuOpen(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {mode === "intake" ? "New Client — Begin Intake" : "New Client — Save as Draft"}
        </DialogTitle>
      </DialogHeader>
      <button
        type="button"
        onClick={() => setMode(null)}
        className="-mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">First Name *</Label>
            <Input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={100} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Last Name *</Label>
            <Input value={last} onChange={(e) => setLast(e.target.value)} maxLength={100} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">Medicaid ID *</Label>
          <Input value={medicaidId} onChange={(e) => setMedicaidId(e.target.value)}
            placeholder="e.g. 1234567890" maxLength={50} className="font-mono" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">Service Address *</Label>
          <Input value={addr} onChange={(e) => setAddr(e.target.value)} maxLength={255} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">Authorized DSPD Billing Codes *</Label>
          <DspdCodesMultiSelect value={jobCodes} onChange={setJobCodes} onOpenChange={setCodesMenuOpen} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">EVV Geofence Radius</Label>
          <Select value={String(radius)} onValueChange={(v) => setRadius(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GEOFENCE_OPTIONS.map((o) => (
                <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox checked={isOwnGuardian} onCheckedChange={(v) => setIsOwnGuardian(!!v)} />
            Client is their own guardian
          </label>
          {!isOwnGuardian && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Guardian Name *</Label>
                  <Input value={gName} onChange={(e) => setGName(e.target.value)} maxLength={150} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Guardian Phone *</Label>
                  <Input value={gPhone} onChange={(e) => setGPhone(e.target.value)} maxLength={30} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Relationship</Label>
                  <Input value={gRel} onChange={(e) => setGRel(e.target.value)} maxLength={100} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Guardian Email</Label>
                  <Input value={gEmail} onChange={(e) => setGEmail(e.target.value)} maxLength={150} type="email" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "intake" ? "Create & Start Intake" : "Create draft client"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

