import { nanoid } from "nanoid";
import {
  deleteVersionLocal,
  getPendingSnapshots,
  queuePendingSnapshot,
  removePendingSnapshot,
  saveVersionLocal,
} from "@/lib/local/indexed-db";
import { syncEngine } from "@/lib/local/sync-engine";
import type { DocumentState, DocumentVersion, VectorClock } from "@/types";

export interface CreateSnapshotInput {
  documentId: string;
  title: string;
  content: string;
  clock: VectorClock;
  userId: string;
  label?: string;
}

export interface CreateSnapshotResult {
  version: DocumentVersion;
  synced: boolean;
}

function formatSnapshotLabel(): string {
  return `Snapshot ${new Date().toLocaleString()}`;
}

function toVersion(
  data: Record<string, unknown>,
  documentId: string,
  userId: string
): DocumentVersion {
  return {
    id: String(data.id),
    documentId,
    title: String(data.title),
    content: String(data.content ?? ""),
    clock: (data.clock as VectorClock) ?? {},
    label: data.label ? String(data.label) : undefined,
    createdBy: String(data.createdBy ?? userId),
    createdAt:
      typeof data.createdAt === "string"
        ? data.createdAt
        : new Date(data.createdAt as string | number).toISOString(),
    isSnapshot: true,
  };
}

export async function createSnapshot(input: CreateSnapshotInput): Promise<CreateSnapshotResult> {
  const label = input.label ?? formatSnapshotLabel();

  if (navigator.onLine) {
    await syncEngine.flush(input.documentId);
  }

  const localVersion: DocumentVersion = {
    id: `local-${nanoid()}`,
    documentId: input.documentId,
    title: input.title,
    content: input.content,
    clock: input.clock,
    label,
    createdBy: input.userId,
    createdAt: new Date().toISOString(),
    isSnapshot: true,
  };

  await saveVersionLocal(localVersion);

  if (!navigator.onLine) {
    await queuePendingSnapshot(localVersion);
    return { version: localVersion, synced: false };
  }

  const res = await fetch(`/api/documents/${input.documentId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label,
      title: input.title,
      content: input.content,
      clock: input.clock,
    }),
  });

  if (!res.ok) {
    await queuePendingSnapshot(localVersion);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to save snapshot");
  }

  const data = await res.json();
  const serverVersion = toVersion(data, input.documentId, input.userId);

  await deleteVersionLocal(localVersion.id);
  await saveVersionLocal(serverVersion);

  return { version: serverVersion, synced: true };
}

export async function syncPendingSnapshots(documentId: string): Promise<void> {
  if (!navigator.onLine) return;

  const pending = await getPendingSnapshots(documentId);
  for (const snap of pending) {
    const res = await fetch(`/api/documents/${documentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: snap.label,
        title: snap.title,
        content: snap.content,
        clock: snap.clock,
      }),
    });

    if (!res.ok) continue;

    const data = await res.json();
    const serverVersion = toVersion(data, documentId, snap.createdBy);
    await deleteVersionLocal(snap.id);
    await saveVersionLocal(serverVersion);
    await removePendingSnapshot(snap.id, documentId);
  }
}

export async function restoreFromLocalVersion(
  version: DocumentVersion
): Promise<Pick<DocumentState, "title" | "content" | "clock">> {
  return {
    title: version.title,
    content: version.content,
    clock: version.clock,
  };
}
