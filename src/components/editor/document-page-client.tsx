"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDocumentLocal } from "@/lib/local/indexed-db";
import { syncEngine } from "@/lib/local/sync-engine";
import { DocumentEditor } from "@/components/editor/document-editor";
import { Loader2, WifiOff } from "lucide-react";
import type { DocumentState } from "@/types";

interface DocumentPageClientProps {
  documentId: string;
  userId: string;
}

export function DocumentPageClient({ documentId, userId }: DocumentPageClientProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineOnly, setOfflineOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      syncEngine.start();
      const local = await getDocumentLocal(documentId);

      if (local && !cancelled) {
        setDoc(local);
        setLoading(false);
      }

      if (navigator.onLine) {
        const bootstrapped = await syncEngine.bootstrapDocument(documentId);
        if (cancelled) return;

        if (bootstrapped) {
          setDoc(bootstrapped);
          setOfflineOnly(false);
        } else if (!local) {
          router.replace("/dashboard");
          return;
        }
      } else if (!local) {
        setOfflineOnly(true);
      }

      if (!cancelled) setLoading(false);
    }

    load();

    const unsub = syncEngine.subscribe((event) => {
      if (event.documentId !== documentId || !event.document) return;
      if (event.type === "pulled") {
        setDoc(event.document);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [documentId, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-label="Loading document from local storage" />
      </div>
    );
  }

  if (offlineOnly || !doc) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center sm:py-24">
        <WifiOff className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <h2 className="text-lg font-semibold">Document not available offline</h2>
        <p className="mt-2 text-sm text-slate-500">
          Open this document once while online to cache it locally, then you can edit offline.
        </p>
      </div>
    );
  }

  return (
    <DocumentEditor
      initialDoc={doc}
      userId={userId}
      onDocumentChange={setDoc}
    />
  );
}
