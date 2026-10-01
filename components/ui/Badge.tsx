import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "default" | "info";

const styles: Record<Variant, string> = {
  success: "bg-green-400/20 text-green-700 border-green-400/40",
  warning: "bg-amber-400/20 text-amber-700 border-amber-400/40",
  danger: "bg-red-400/20 text-red-700 border-red-400/40",
  info: "bg-blue-400/20 text-blue-700 border-blue-400/40",
  default: "bg-zinc-300/20 text-zinc-600 border-zinc-400/40",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm border",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
