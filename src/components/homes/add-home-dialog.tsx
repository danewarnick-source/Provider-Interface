// + Add home: name and kind. Saving says "Home added" and opens the new home
// with its Name field focused (#name). Won't close on a click outside or
// Escape once something is typed; Cancel closes.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HOME_KINDS, type HomeKind } from "@/lib/homes/home-kind";
import { homePatchProblems } from "@/lib/homes/home-setup";
import { createHome } from "@/lib/homes/homes.functions";
import { useRefreshHomes } from "./use-homes";

export function AddHomeDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HomeKind | "">("");
  const navigate = useNavigate();
  const refresh = useRefreshHomes();
  const createFn = useServerFn(createHome);
  const add = useMutation({
    mutationFn: () => createFn({ data: { organizationId: orgId, name, kind: kind as HomeKind } }),
    onSuccess: ({ id }) => {
      toast.success("Home added");
      refresh();
      onClose();
      void navigate({
        to: "/dashboard/settings/homes/$teamId",
        params: { teamId: id },
        hash: "name",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dirty = !!name.trim() || !!kind;
  const problem = !kind
    ? "Pick the kind of home."
    : (homePatchProblems({ team_name: name })[0] ?? null);
  const keepOpen = (e: Event) => {
    if (dirty) e.preventDefault();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dirty && onClose()}>
      <DialogContent onInteractOutside={keepOpen} onEscapeKeyDown={keepOpen}>
        <DialogHeader>
          <DialogTitle>Add home</DialogTitle>
          <DialogDescription>
            Name it the way your team says it. You can add the lead, address and staffing needs
            next.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!problem) add.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="new-home-name">Name</Label>
            <Input
              id="new-home-name"
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maple House"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-home-kind">Kind of home</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as HomeKind)}>
              <SelectTrigger id="new-home-kind">
                <SelectValue placeholder="Pick the kind" />
              </SelectTrigger>
              <SelectContent>
                {HOME_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={add.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!!problem || add.isPending}
              title={problem ?? undefined}
            >
              {add.isPending ? "Adding…" : "Add home"}
            </Button>
          </DialogFooter>
          {dirty && problem ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
