import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-pt text-pri",
        secondary: "bg-pt text-pri hover:bg-pt2",
        destructive: "bg-danger-50 text-danger-700",
        outline: "bg-paper text-pri shadow-[inset_0_0_0_1px_var(--denim-pt2)]",
        success: "bg-acct text-accd shadow-[inset_0_0_0_1px_var(--denim-acctb)]",
        warning: "bg-warning-50 text-warning-700",
        accent: "bg-acct text-accd shadow-[inset_0_0_0_1px_var(--denim-acctb)]",
        life: "bg-acct text-accd shadow-[inset_0_0_0_1px_var(--denim-acctb)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
