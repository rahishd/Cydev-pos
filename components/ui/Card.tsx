import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardColor = "primary" | "success" | "warning" | "danger" | "info" | "purple" | "pink" | "cyan" | undefined;

export function Card({
  className,
  color,
  ...props
}: HTMLAttributes<HTMLDivElement> & { color?: CardColor }) {
  const colorClass = color ? `glass-card-${color}` : "glass-card";

  return (
    <div
      className={cn(
        colorClass,
        "p-4",
        className
      )}
      {...props}
    />
  );
}
