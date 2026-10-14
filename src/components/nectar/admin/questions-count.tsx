// The open Questions count (N6, Decision 9) on the admin Nectar nav item.
// Only people who can see Questions fetch it or see it.

import { cn } from "@/lib/utils";
import { useNectarAdminAccess, useOpenQuestionCount } from "./use-nectar-admin";

export function NectarQuestionsCount({ className }: { className?: string }) {
  const { orgId, canView } = useNectarAdminAccess();
  const count = useOpenQuestionCount(orgId, canView);
  const open = count.data?.open ?? 0;
  if (!canView || open <= 0) return null;
  return (
    <span
      aria-label={`${open} open ${open === 1 ? "question" : "questions"}`}
      className={cn(
        "ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--hive-gold)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white",
        className,
      )}
    >
      {open > 99 ? "99+" : open}
    </span>
  );
}
