import { cn } from "@/lib/utils";

/** A person's photo, or their first initial when they haven't added one. */
export function Avatar({
  id,
  name,
  version,
  className,
}: {
  id: string;
  name: string;
  version: number;
  className?: string;
}) {
  if (version > 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${id}?v=${version}`}
        alt={name}
        className={cn("shrink-0 rounded-xl bg-[#ffffff] object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-[#ffffff] font-bold text-orange-600",
        className
      )}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}
