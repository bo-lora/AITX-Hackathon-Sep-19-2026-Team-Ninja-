import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-[3px] border border-line bg-paper px-3 py-2 text-sm text-navy placeholder:text-muted outline-none focus-visible:border-mint focus-visible:ring-2 focus-visible:ring-mint/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
