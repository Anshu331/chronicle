"use client";

import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  status: "online" | "offline" | "syncing" | "synced" | "error";
  className?: string;
}

export function SyncStatus({ status, className }: SyncStatusProps) {
  const config = {
    online: { icon: Wifi, label: "Online", short: "On", color: "text-emerald-600" },
    offline: { icon: WifiOff, label: "Offline", short: "Off", color: "text-amber-600" },
    syncing: { icon: RefreshCw, label: "Syncing", short: "…", color: "text-blue-600" },
    synced: { icon: CheckCircle2, label: "Synced", short: "OK", color: "text-emerald-600" },
    error: { icon: WifiOff, label: "Error", short: "!", color: "text-red-600" },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", config.color, className)}
      role="status"
      aria-label={config.label}
      title={config.label}
    >
      <Icon className={cn("h-4 w-4", status === "syncing" && "animate-spin")} aria-hidden />
      <span className="hidden sm:inline">{config.label}</span>
      <span className="sm:hidden">{config.short}</span>
    </div>
  );
}
