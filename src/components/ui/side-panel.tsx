"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function SidePanel({ title, onClose, children, footer, className }: SidePanelProps) {
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950",
          "md:static md:z-auto md:h-full md:min-h-0 md:w-80 md:max-w-none md:shrink-0 md:shadow-none",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={`Close ${title}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-200 bg-white/90 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}
