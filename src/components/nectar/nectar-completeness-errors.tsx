import { COMPLETENESS_LABELS, type CompletenessItem } from "@/lib/nectar-completeness";

/**
 * Inline submit-gate errors for the four NECTAR completeness items.
 * Phone-first: full-width, specific, no second review step.
 */
export function NectarCompletenessErrors({
  checks,
}: {
  checks: CompletenessItem[];
}) {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) return null;

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-danger-500/40 bg-danger-500/10 px-3 py-2.5"
    >
      <p className="text-xs font-semibold text-danger-800 dark:text-danger-200">
        NECTAR completeness check — fix these, then tap Submit again
      </p>
      <ul className="space-y-1.5">
        {failed.map((item) => (
          <li key={item.key} className="text-xs leading-relaxed text-danger-800 dark:text-danger-200">
            <span className="font-semibold">{COMPLETENESS_LABELS[item.key]}.</span>{" "}
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
