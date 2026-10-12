import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[14.5px] font-semibold cursor-pointer transition-[background-color,box-shadow,transform,color] duration-200 ease-denim focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(39,76,119,0.15)] focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-10px_rgba(39,76,119,0.55)] hover:bg-deep hover:-translate-y-px",
        cta:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-10px_rgba(39,76,119,0.55)] hover:bg-deep hover:-translate-y-px",
        secondary:
          "bg-white/55 text-pri shadow-[inset_0_0_0_1px_var(--denim-pt2)] hover:bg-white",
        ghostOnDark:
          "bg-white/5 text-ondark shadow-[inset_0_0_0_1px_rgba(225,234,243,0.22)] hover:bg-white/10 hover:text-white",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-10px_rgba(217,45,32,0.5)] hover:bg-danger-700 hover:-translate-y-px",
        outline:
          "bg-white/55 text-pri shadow-[inset_0_0_0_1px_var(--denim-pt2)] hover:bg-white",
        ghost: "text-pri hover:bg-pt",
        link: "text-pri underline-offset-4 hover:underline hover:text-deep",
        life: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-10px_rgba(39,76,119,0.55)] hover:bg-deep hover:-translate-y-px",
      },
      size: {
        default: "h-[var(--height-button)] px-[18px] py-2",
        sm: "h-[var(--height-button-sm)] px-3.5 text-[13.5px]",
        lg: "h-[var(--height-button-lg)] px-6 text-[15px]",
        icon: "h-[var(--height-button)] w-[var(--height-button)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
