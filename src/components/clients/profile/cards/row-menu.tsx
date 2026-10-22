// The ⋯ menu for rare or risky actions on a card or row (end, archive,
// remove). 40 px square outline button, 44 px on phones.

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  testId?: string;
};

export function RowMenu({
  label,
  items,
  testId,
}: {
  /** aria-label, e.g. "More actions for Home". */
  label: string;
  items: (RowMenuItem | null | false)[];
  testId?: string;
}) {
  const shown = items.filter((i): i is RowMenuItem => !!i);
  if (shown.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 max-md:h-11 max-md:w-11"
          aria-label={label}
          title={label}
          data-testid={testId}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shown.map((i) => (
          <DropdownMenuItem
            key={i.label}
            disabled={i.disabled}
            onSelect={i.onSelect}
            className={cn(i.danger && "text-destructive focus:text-destructive")}
            data-testid={i.testId}
          >
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
