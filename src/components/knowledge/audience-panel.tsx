import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { setLibraryAudience } from "@/lib/nectar/library/library.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { useRefreshKnowledge } from "./use-knowledge";

type Choice = { audienceAll: boolean; userIds: string[] };

/**
 * Who it's for (Decision 5): "All team members" or "Only the people I check".
 * Each change saves at once; while it saves, the panel shows the new choice.
 */
export function AudiencePanel({
  orgId,
  documentId,
  audienceAll,
  people,
  canEdit,
}: {
  orgId: string;
  documentId: string;
  audienceAll: boolean;
  people: Array<{ userId: string; name: string; checked: boolean }>;
  canEdit: boolean;
}) {
  const setFn = useServerFn(setLibraryAudience);
  const refresh = useRefreshKnowledge(orgId);
  const save = useMutation({
    mutationFn: (choice: Choice) =>
      setFn({ data: { organizationId: orgId, documentId, ...choice } }),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save who it's for.")),
  });
  const saved: Choice = {
    audienceAll,
    userIds: audienceAll ? [] : people.filter((p) => p.checked).map((p) => p.userId),
  };
  const shown = save.isPending && save.variables ? save.variables : saved;
  const disabled = !canEdit || save.isPending;
  const toggle = (userId: string, on: boolean) =>
    save.mutate({
      audienceAll: false,
      userIds: on ? [...shown.userIds, userId] : shown.userIds.filter((id) => id !== userId),
    });

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <legend className="px-1 text-sm font-semibold text-[var(--hive-text)]">Who it's for</legend>
      <RadioGroup
        value={shown.audienceAll ? "all" : "some"}
        disabled={disabled}
        onValueChange={(v) =>
          save.mutate(
            v === "all" ? { audienceAll: true, userIds: [] } : { ...saved, audienceAll: false },
          )
        }
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="all" id="kb-audience-all" />
          <Label htmlFor="kb-audience-all" className="font-normal">
            All team members
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="some" id="kb-audience-some" />
          <Label htmlFor="kb-audience-some" className="font-normal">
            Only the people I check
          </Label>
        </div>
      </RadioGroup>
      {shown.audienceAll ? null : (
        <div className="space-y-2 pl-6">
          {people.map((p) => (
            <div key={p.userId} className="flex items-center gap-2">
              <Checkbox
                id={`kb-audience-${p.userId}`}
                checked={shown.userIds.includes(p.userId)}
                disabled={disabled}
                onCheckedChange={(v) => toggle(p.userId, v === true)}
              />
              <Label htmlFor={`kb-audience-${p.userId}`} className="font-normal">
                {p.name}
              </Label>
            </div>
          ))}
          {shown.userIds.length === 0 ? (
            <p role="alert" className="text-xs font-semibold text-[var(--hive-danger-fg)]">
              Check at least one person, or nobody will see it.
            </p>
          ) : null}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Only these people see it, are asked to review it, and get Nectar answers from it.
      </p>
    </fieldset>
  );
}
