import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "default" | "info";

const styles: Record<Variant, string> = {
  success: "bg-gradient-to-r from-green-400/40 to-emerald-400/40 text-green-800 border-green-500/60 shadow-lg",
  warning: "bg-gradient-to-r from-amber-400/40 to-orange-400/40 text-amber-900 border-amber-500/60 shadow-lg",
  danger: "bg-gradient-to-r from-red-400/40 to-rose-400/40 text-red-900 border-red-500/60 shadow-lg",
  info: "bg-gradient-to-r from-blue-400/40 to-cyan-400/40 text-blue-900 border-blue-500/60 shadow-lg",
  default: "bg-gradient-to-r from-zinc-400/40 to-slate-400/40 text-zinc-900 border-zinc-500/60 shadow-lg",
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
        "inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold backdrop-blur-md border-1.5 transition-all duration-300 hover:shadow-xl hover:scale-105",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
