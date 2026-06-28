"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllDocumentsLocal } from "@/lib/local/indexed-db";
import { syncEngine } from "@/lib/local/sync-engine";
import { saveDocumentLocal } from "@/lib/local/indexed-db";
import { NewDocumentButton } from "@/components/dashboard/new-document-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { FileText, Loader2 } from "lucide-react";
import type { DocumentRole, DocumentState } from "@/types";

interface DocSummary {
  id: string;
  title: string;
  preview: string;
  role: DocumentRole;
  updatedAt: string;
}

function toSummary(doc: DocumentState): DocSummary {
  return {
    id: doc.id,
    title: doc.title,
    preview: doc.content.slice(0, 200),
    role: doc.role,
    updatedAt: doc.updatedAt,
  };
}

export function DashboardClient() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"local" | "server">("local");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      syncEngine.start();

      const local = await getAllDocumentsLocal();
      if (!cancelled && local.length > 0) {
        setDocs(local.map(toSummary));
        setSource("local");
        setLoading(false);
      }

      if (navigator.onLine) {
        try {
          const res = await fetch("/api/documents");
          if (res.ok && !cancelled) {
            const remote = await res.json();
            for (const d of remote) {
              const existing = local.find((x) => x.id === d.id);
              await saveDocumentLocal({
                id: d.id,
                title: d.title,
                content: existing?.content && existing.content.length > (d.content?.length ?? 0)
                  ? existing.content
                  : (d.content ?? ""),
                clock: (d.clock as Record<string, number>) ?? existing?.clock ?? {},
                role: d.role,
                ownerId: d.ownerId ?? existing?.ownerId ?? "",
                updatedAt: d.updatedAt,
                localOnly: false,
              });
            }
            const merged = await getAllDocumentsLocal();
            setDocs(merged.map(toSummary));
            setSource("server");
          }
        } catch {
          // keep local list
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Your Documents</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            {source === "local" && typeof navigator !== "undefined" && !navigator.onLine
              ? "Showing cached documents (offline)"
              : "Loaded from local cache — syncing in background"}
          </p>
        </div>
        <div className="shrink-0">
          <NewDocumentButton />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <FileText className="mb-4 h-12 w-12 text-slate-300" />
            <p className="mb-4 text-slate-500">No documents yet</p>
            <NewDocumentButton />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {docs.map((doc) => (
            <Link key={doc.id} href={`/docs/${doc.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <FileText className="h-5 w-5 text-violet-600" />
                  </div>
                  <h3 className="font-semibold line-clamp-1">{doc.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {doc.preview || "Empty document"}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span className="capitalize">{doc.role}</span>
                    <span>{formatRelativeTime(doc.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
