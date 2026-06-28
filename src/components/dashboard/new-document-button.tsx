"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveDocumentLocal } from "@/lib/local/indexed-db";
import { Plus, Loader2 } from "lucide-react";

export function NewDocumentButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createDocument = async () => {
    setCreating(true);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Document" }),
    });
    if (res.ok) {
      const doc = await res.json();
      await saveDocumentLocal({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        clock: doc.clock ?? {},
        role: doc.role,
        ownerId: doc.ownerId,
        updatedAt: doc.updatedAt,
      });
      router.push(`/docs/${doc.id}`);
    }
    setCreating(false);
  };

  return (
    <Button onClick={createDocument} disabled={creating} className="w-full sm:w-auto">
      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      New Document
    </Button>
  );
}
