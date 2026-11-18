// "Ratio" on an authorization card: the staffing ratio the scheduler reads
// (client_billing_codes.ratio). Billing: Edit holders pick 1:1 … 2:1 or Not set
// and it saves at once ("Ratio saved"); everyone else sees the value.
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAuthorizationRatio } from "@/lib/clients/services/services.functions";
import {
  RATIO_CHOICES,
  ratioChoice,
  ratioText,
  type RatioChoice,
} from "@/lib/clients/services/ratio";
import { useRefreshServices } from "./use-client-services";

const NOT_SET = "none";

export function AuthorizationRatio(props: {
  orgId: string;
  clientId: string;
  id: string;
  code: string;
  ratio: string | null;
  canEdit: boolean;
}) {
  const refresh = useRefreshServices(props.clientId);
  const saveFn = useServerFn(saveAuthorizationRatio);
  const save = useMutation({
    mutationFn: (ratio: RatioChoice | null) =>
      saveFn({
        data: { organizationId: props.orgId, clientId: props.clientId, id: props.id, ratio },
      }),
    onSuccess: () => {
      toast.success("Ratio saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!props.canEdit) {
    return <p className="text-xs text-muted-foreground">Ratio: {ratioText(props.ratio)}</p>;
  }
  const value = ratioChoice(props.ratio) ?? NOT_SET;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <label htmlFor={`ratio-${props.id}`}>Ratio</label>
      <Select
        value={value}
        disabled={save.isPending}
        onValueChange={(v) => save.mutate(v === NOT_SET ? null : (v as RatioChoice))}
      >
        <SelectTrigger
          id={`ratio-${props.id}`}
          aria-label={`Ratio for ${props.code}`}
          className="h-8 w-[120px] max-md:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_SET}>Not set</SelectItem>
          {RATIO_CHOICES.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.ratio && !ratioChoice(props.ratio) ? <span>Saved as “{props.ratio}”</span> : null}
    </div>
  );
}
