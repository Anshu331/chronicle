"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";
import { cacheVersionsLocal, getVersionsLocal } from "@/lib/local/indexed-db";
import type { DocumentVersion } from "@/types";
import { SidePanel } from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { RotateCcw, Camera } from "lucide-react";

interface VersionTimelineProps {
  documentId: string;
  refreshKey?: number;
  onRestore: (versionId: string) => void;
  onClose: () => void;
  canEdit: boolean;
}

function mergeVersions(local: DocumentVersion[], remote: DocumentVersion[]): DocumentVersion[] {
  const map = new Map<string, DocumentVersion>();
  for (const v of [...local, ...remote]) {
    map.set(v.id, v);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function VersionTimeline({
  documentId,
  refreshKey = 0,
  onRestore,
  onClose,
  canEdit,
}: VersionTimelineProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selected, setSelected] = useState<DocumentVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    const cached = await getVersionsLocal(documentId);

    if (!navigator.onLine) {
      setVersions(cached);
      setOffline(true);
      setLoading(false);
      return;
    }

    setOffline(false);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (res.ok) {
        const data: DocumentVersion[] = await res.json();
        const merged = mergeVersions(cached, data);
        setVersions(merged);
        await cacheVersionsLocal(data);
      } else {
        setVersions(cached);
      }
    } catch {
      setVersions(cached);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadVersions();
  }, [documentId, refreshKey, loadVersions]);

  return (
    <SidePanel
      title="Version History"
      onClose={onClose}
      className="bg-slate-50 dark:bg-slate-950"
      footer={
        selected && canEdit ? (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onRestore(selected.id)}
            aria-label={`Restore version ${selected.label}`}
          >
            <RotateCcw className="h-4 w-4" />
            Restore this version
          </Button>
        ) : undefined
      }
    >
      {offline && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Offline — showing cached versions
        </p>
      )}

      <div className="p-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading timeline…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-slate-500">No snapshots yet. Save one to start time travel.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-violet-200 pl-4 dark:border-violet-800" aria-label="Document version history">
            {versions.map((v) => (
              <li key={v.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-violet-500 ring-4 ring-slate-50 dark:ring-slate-950" />
                <button
                  type="button"
                  onClick={() => setSelected(v)}
                  className={`w-full rounded-lg p-3 text-left transition-colors ${
                    selected?.id === v.id
                      ? "bg-violet-100 dark:bg-violet-900/30"
                      : "hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <Camera className="h-3 w-3 shrink-0" />
                    {formatRelativeTime(v.createdAt)}
                    {v.id.startsWith("local-") && (
                      <span className="rounded bg-amber-100 px-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        local
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">{v.label ?? "Snapshot"}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {v.content ? `${v.content.slice(0, 80)}${v.content.length > 80 ? "…" : ""}` : "Empty document"}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        )}

        {selected && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="mb-2 text-xs text-slate-500">Preview</p>
            <p className="max-h-40 overflow-y-auto text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {selected.content
                ? `${selected.content.slice(0, 500)}${selected.content.length > 500 ? "…" : ""}`
                : "Empty document"}
            </p>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
