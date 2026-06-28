import { mergeRemoteWithPending, rebuildFromOperations } from "@/lib/crdt/merge";
import {
  clearPendingTitle,
  clearSyncedItems,
  deleteSyncQueueItem,
  getAppliedOpIds,
  getClientId,
  getDocumentLocal,
  getPendingSyncItems,
  getPendingTitle,
  markOpApplied,
  saveDocumentLocal,
  setPendingTitle,
  updateSyncItemStatus,
} from "@/lib/local/indexed-db";
import type { DocumentState, SyncResponse } from "@/types";
import { syncPendingSnapshots } from "@/lib/local/snapshots";

type SyncListener = (event: {
  type: "syncing" | "synced" | "error" | "offline" | "pulled";
  documentId?: string;
  document?: DocumentState;
}) => void;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

class SyncEngine {
  private listeners = new Set<SyncListener>();
  private syncing = false;
  private globalIntervalId: ReturnType<typeof setInterval> | null = null;
  private pullIntervals = new Map<string, ReturnType<typeof setInterval>>();

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Parameters<SyncListener>[0]) {
    this.listeners.forEach((l) => l(event));
  }

  start() {
    if (typeof window === "undefined") return;
    if (this.globalIntervalId) return;

    window.addEventListener("online", () => this.flush());
    this.globalIntervalId = setInterval(() => {
      if (navigator.onLine) this.flush();
    }, 15_000);
  }

  stop() {
    if (this.globalIntervalId) clearInterval(this.globalIntervalId);
    this.globalIntervalId = null;
    this.pullIntervals.forEach((id) => clearInterval(id));
    this.pullIntervals.clear();
  }

  /** Poll remote changes while a document editor is open (real-time via HTTP pull). */
  watchDocument(documentId: string, intervalMs = 5_000) {
    this.stopWatching(documentId);
    const id = setInterval(() => {
      if (navigator.onLine) {
        this.pullDocument(documentId).catch(() => undefined);
      }
    }, intervalMs);
    this.pullIntervals.set(documentId, id);
  }

  stopWatching(documentId: string) {
    const id = this.pullIntervals.get(documentId);
    if (id) clearInterval(id);
    this.pullIntervals.delete(documentId);
  }

  async flush(documentId?: string): Promise<void> {
    if (!navigator.onLine) {
      this.emit({ type: "offline" });
      return;
    }
    if (this.syncing) return;

    this.syncing = true;

    try {
      const pending = await getPendingSyncItems(documentId);
      const docIds = documentId
        ? [documentId]
        : [...new Set(pending.map((p) => p.documentId))];

      for (const id of docIds) {
        this.emit({ type: "syncing", documentId: id });
        try {
          const localDoc = await getDocumentLocal(id);
          await this.syncPendingTitle(id);

          if (localDoc?.role === "viewer") {
            await this.pullDocument(id);
          } else {
            await syncPendingSnapshots(id);
            await this.syncDocument(id);
            await clearSyncedItems(id);
          }

          this.emit({ type: "synced", documentId: id });
        } catch {
          const items = await getPendingSyncItems(id);
          for (const item of items) {
            const retries = item.retries + 1;
            if (retries >= MAX_RETRIES) {
              await updateSyncItemStatus(item.id, "failed", retries);
            } else {
              await updateSyncItemStatus(item.id, "pending", retries);
            }
          }
          this.emit({ type: "error", documentId: id });
          await this.delay(BASE_DELAY_MS * 2);
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async syncPendingTitle(documentId: string): Promise<void> {
    const pendingTitle = await getPendingTitle(documentId);
    if (!pendingTitle || !navigator.onLine) return;

    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: pendingTitle }),
    });

    if (res.ok) {
      await clearPendingTitle(documentId);
      const local = await getDocumentLocal(documentId);
      if (local) {
        await saveDocumentLocal({
          ...local,
          title: pendingTitle,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  async queueTitleChange(documentId: string, title: string): Promise<void> {
    const trimmed = title.trim() || "Untitled Document";
    await setPendingTitle(documentId, trimmed);
    const local = await getDocumentLocal(documentId);
    if (local) {
      await saveDocumentLocal({
        ...local,
        title: trimmed,
        updatedAt: new Date().toISOString(),
      });
    }
    if (navigator.onLine) {
      await this.syncPendingTitle(documentId);
    }
  }

  async syncDocument(documentId: string): Promise<SyncResponse | null> {
    const doc = await getDocumentLocal(documentId);
    if (!doc) return null;

    const role = doc.role;
    if (role === "viewer") return null;

    const clientId = await getClientId();
    const pending = await getPendingSyncItems(documentId);
    const operations = pending.map((p) => p.operation);

    const res = await fetch(`/api/documents/${documentId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        clientId,
        clientClock: doc.clock,
        operations,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Sync failed");
    }

    const data: SyncResponse = await res.json();
    const appliedIds = await getAppliedOpIds(documentId);
    const pendingOps = operations;
    const pendingTitle = await getPendingTitle(documentId);

    const merged = mergeRemoteWithPending(
      data.content,
      data.serverClock,
      pendingOps.filter((op) => !appliedIds.has(op.id)),
      data.operations,
      appliedIds
    );

    const updated: DocumentState = {
      ...doc,
      title: pendingTitle ?? doc.title,
      content: merged.content,
      clock: merged.clock,
      updatedAt: new Date().toISOString(),
      localOnly: false,
    };

    await saveDocumentLocal(updated);

    for (const op of [...operations, ...data.operations]) {
      await markOpApplied(op.id, documentId);
      await deleteSyncQueueItem(op.id);
    }

    this.emit({ type: "pulled", documentId, document: updated });
    return data;
  }

  async pullDocument(documentId: string): Promise<DocumentState | null> {
    const local = await getDocumentLocal(documentId);

    if (!navigator.onLine) {
      return local ?? null;
    }

    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) return local ?? null;

      const remote = await res.json();
      const appliedIds = await getAppliedOpIds(documentId);
      const pending = await getPendingSyncItems(documentId);
      const pendingOps = pending.map((p) => p.operation);
      const serverOps = remote.pendingOps ?? [];
      const pendingTitle = await getPendingTitle(documentId);

      const merged = rebuildFromOperations([...serverOps, ...pendingOps]);

      const localUpdated = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      const resolvedTitle = pendingTitle
        ? pendingTitle
        : local?.title && localUpdated >= remoteUpdated
          ? local.title
          : remote.title;

      const state: DocumentState = {
        id: documentId,
        title: resolvedTitle,
        content: merged.content,
        clock: merged.clock,
        role: remote.role,
        ownerId: remote.ownerId,
        updatedAt: pendingTitle || (localUpdated >= remoteUpdated && local?.updatedAt)
          ? new Date().toISOString()
          : remote.updatedAt,
        localOnly: false,
      };

      await saveDocumentLocal(state);
      this.emit({ type: "pulled", documentId, document: state });
      return state;
    } catch {
      return local ?? null;
    }
  }

  async bootstrapDocument(documentId: string): Promise<DocumentState | null> {
    const local = await getDocumentLocal(documentId);

    if (local) {
      this.emit({ type: "pulled", documentId, document: local });
    }

    if (navigator.onLine) {
      const pulled = await this.pullDocument(documentId);
      if (pulled) {
        await syncPendingSnapshots(documentId);
        await this.flush(documentId);
        return pulled;
      }
    }

    return local ?? null;
  }
}

export const syncEngine = new SyncEngine();
