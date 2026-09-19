import { cn } from "@/lib/utils";

function Badge({
  className,
  tone = "paper",
  ...props
}: React.ComponentProps<"span"> & { tone?: "paper" | "live" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase",
        tone === "paper" && "bg-paper text-navy border border-line",
        tone === "live" && "bg-live text-paper",
        tone === "ink" && "bg-navy text-paper",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
