"use client";

import { useEffect } from "react";
import { saveDocumentLocal } from "@/lib/local/indexed-db";
import { syncEngine } from "@/lib/local/sync-engine";
import type { DocumentRole } from "@/types";

interface DocSummary {
  id: string;
  title: string;
  content: string;
  role: DocumentRole | null;
  ownerId: string;
  updatedAt: string;
  clock: Record<string, number>;
}

export function LocalCacheHydrator({ documents }: { documents: DocSummary[] }) {
  useEffect(() => {
    syncEngine.start();
    documents.forEach((d) => {
      if (!d.role) return;
      saveDocumentLocal({
        id: d.id,
        title: d.title,
        content: d.content,
        clock: d.clock,
        role: d.role,
        ownerId: d.ownerId,
        updatedAt: d.updatedAt,
      });
    });
  }, [documents]);

  return null;
}
