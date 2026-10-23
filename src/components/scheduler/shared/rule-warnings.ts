// Shows the scheduler rule engine's warnings after a save, publish, claim or
// copy (B1). Refusals arrive as errors; warnings never stop the action.
import { toast } from "sonner";

export function toastRuleWarnings(res: { warnings?: readonly string[] } | null | undefined): void {
  if (res?.warnings?.length) toast.warning(res.warnings.join(" · "));
}
