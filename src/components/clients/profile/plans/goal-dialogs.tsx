// Add / edit one goal or one support on the client's current plan.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveClientGoal, saveGoalSupport } from "@/lib/clients/plans.functions";
import type { GoalView } from "@/lib/clients/plans";

type Scope = { organizationId: string; clientId: string };

export function GoalDialog({
  scope, planId, goal, open, onClose, onSaved,
}: {
  scope: Scope; planId: string; goal: GoalView | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const saveFn = useServerFn(saveClientGoal);
  const [text, setText] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setText(goal?.goal ?? ""); setDomain(goal?.domain ?? ""); }
  }, [open, goal]);

  async function save() {
    setBusy(true);
    try {
      await saveFn({ data: { ...scope, planId, goalId: goal?.id ?? null, goal: { goal_text: text, domain } } });
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="goal-text">Goal (as written in the PCSP)</Label>
            <Textarea id="goal-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="goal-domain">Area (optional)</Label>
            <Input id="goal-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. Health, Community" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !text.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupportDialog({
  scope, goal, support, codes, open, onClose, onSaved,
}: {
  scope: Scope;
  goal: GoalView | null;
  support: GoalView["supports"][number] | null;
  codes: string[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveGoalSupport);
  const [text, setText] = useState("");
  const [details, setDetails] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setText(support?.support_text ?? "");
      setDetails(support?.details ?? "");
      setPicked(support?.our_codes ?? []);
    }
  }, [open, support]);
  const choices = [...new Set([...codes, ...picked])].sort();
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function save() {
    if (!goal) return;
    setBusy(true);
    try {
      await saveFn({
        data: { ...scope, goalId: goal.id, supportId: support?.id ?? null, support: { support_text: text, details, our_codes: picked } },
      });
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{support ? "Edit support" : "Add support"}</DialogTitle></DialogHeader>
        <p className="line-clamp-2 text-xs text-muted-foreground">{goal?.goal}</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="support-text">What the team member does</Label>
            <Textarea id="support-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="support-details">Details (how often, measure)</Label>
            <Textarea id="support-details" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Codes paid to us for this support</Label>
            {choices.length === 0 ? (
              <p className="text-xs text-amber-700">No active codes for this client. Add authorizations under Billing first.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {choices.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    aria-pressed={picked.includes(c)}
                    className={`rounded border px-2 py-0.5 font-mono text-xs ${
                      picked.includes(c) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Team members working a picked code see this support on their notes.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
