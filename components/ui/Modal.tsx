"use client";

import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={cn("flex max-h-[90vh] max-h-[90dvh] w-full flex-col rounded-lg bg-surface shadow-lg", sizeClasses[size])}>
        {title && (
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-semibold text-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 rounded px-2 py-1 text-lg leading-none text-text-muted hover:bg-zinc-100 hover:text-text"
            >
              ×
            </button>
          </div>
        )}
        <div className="overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}
