import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-navy text-paper hover:bg-[#2a3548]",
        mint: "bg-mint text-navy hover:bg-[#3bbca6]",
        paper: "bg-paper text-navy border border-line hover:bg-[#f7f1e4]",
        outline:
          "bg-transparent text-navy border border-navy hover:bg-navy hover:text-paper",
        ghost: "bg-transparent text-navy hover:bg-navy/5",
        danger: "bg-danger text-paper hover:bg-[#9b1c14]",
      },
      size: {
        default: "h-10 px-4 rounded-[3px]",
        sm: "h-8 px-3 text-[13px] rounded-[3px]",
        lg: "h-12 px-5 text-base rounded-[3px]",
        pill: "h-11 px-5 rounded-full",
        hero: "h-14 px-6 text-[15px] rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
