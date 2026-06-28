import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DocumentOperation, DocumentState, DocumentVersion, SyncQueueItem } from "@/types";

interface ChronicleDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentState;
    indexes: { "by-updated": string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { "by-document": string; "by-status": string };
  };
  versions: {
    key: string;
    value: DocumentVersion;
    indexes: { "by-document": string };
  };
  appliedOps: {
    key: string;
    value: { id: string; documentId: string };
    indexes: { "by-document": string };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbPromise: Promise<IDBPDatabase<ChronicleDB>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<ChronicleDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChronicleDB>("chronicle-local", 1, {
      upgrade(db) {
        const docs = db.createObjectStore("documents", { keyPath: "id" });
        docs.createIndex("by-updated", "updatedAt");

        const queue = db.createObjectStore("syncQueue", { keyPath: "id" });
        queue.createIndex("by-document", "documentId");
        queue.createIndex("by-status", "status");

        const versions = db.createObjectStore("versions", { keyPath: "id" });
        versions.createIndex("by-document", "documentId");

        const applied = db.createObjectStore("appliedOps", { keyPath: "id" });
        applied.createIndex("by-document", "documentId");

        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function getClientId(): Promise<string> {
  const db = await getLocalDB();
  const existing = await db.get("meta", "clientId");
  if (existing) return existing.value;

  const clientId = crypto.randomUUID();
  await db.put("meta", { key: "clientId", value: clientId });
  return clientId;
}

export async function saveDocumentLocal(doc: DocumentState): Promise<void> {
  const db = await getLocalDB();
  await db.put("documents", doc);
}

export async function getDocumentLocal(id: string): Promise<DocumentState | undefined> {
  const db = await getLocalDB();
  return db.get("documents", id);
}

export async function getAllDocumentsLocal(): Promise<DocumentState[]> {
  const db = await getLocalDB();
  return db.getAllFromIndex("documents", "by-updated");
}

export async function enqueueSync(item: SyncQueueItem): Promise<void> {
  const db = await getLocalDB();
  await db.put("syncQueue", item);
}

export async function getPendingSyncItems(documentId?: string): Promise<SyncQueueItem[]> {
  const db = await getLocalDB();
  const all = await db.getAll("syncQueue");
  return all
    .filter((item) => item.status === "pending" || item.status === "failed")
    .filter((item) => !documentId || item.documentId === documentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateSyncItemStatus(
  id: string,
  status: SyncQueueItem["status"],
  retries?: number
): Promise<void> {
  const db = await getLocalDB();
  const item = await db.get("syncQueue", id);
  if (!item) return;
  await db.put("syncQueue", { ...item, status, retries: retries ?? item.retries });
}

export async function clearSyncedItems(documentId: string): Promise<void> {
  const db = await getLocalDB();
  const all = await db.getAll("syncQueue");
  const tx = db.transaction("syncQueue", "readwrite");
  for (const item of all) {
    if (item.documentId === documentId && item.status !== "pending" && item.status !== "failed") {
      await tx.store.delete(item.id);
    }
  }
  await tx.done;
}

export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete("syncQueue", id);
}

export async function setPendingTitle(documentId: string, title: string): Promise<void> {
  const db = await getLocalDB();
  await db.put("meta", { key: `titlePending:${documentId}`, value: title });
}

export async function getPendingTitle(documentId: string): Promise<string | undefined> {
  const db = await getLocalDB();
  const entry = await db.get("meta", `titlePending:${documentId}`);
  return entry?.value;
}

export async function clearPendingTitle(documentId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete("meta", `titlePending:${documentId}`);
}

export async function cacheVersionsLocal(versions: DocumentVersion[]): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction("versions", "readwrite");
  for (const v of versions) {
    await tx.store.put(v);
  }
  await tx.done;
}

export async function saveVersionLocal(version: DocumentVersion): Promise<void> {
  const db = await getLocalDB();
  await db.put("versions", version);
}

export async function deleteVersionLocal(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete("versions", id);
}

export async function getVersionsLocal(documentId: string): Promise<DocumentVersion[]> {
  const db = await getLocalDB();
  const versions = await db.getAllFromIndex("versions", "by-document", documentId);
  return versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const pendingSnapshotsKey = (documentId: string) => `pendingSnapshots:${documentId}`;

export async function queuePendingSnapshot(version: DocumentVersion): Promise<void> {
  const db = await getLocalDB();
  const key = pendingSnapshotsKey(version.documentId);
  const existing = await db.get("meta", key);
  const list: DocumentVersion[] = existing ? JSON.parse(existing.value) : [];
  list.push(version);
  await db.put("meta", { key, value: JSON.stringify(list) });
}

export async function getPendingSnapshots(documentId: string): Promise<DocumentVersion[]> {
  const db = await getLocalDB();
  const key = pendingSnapshotsKey(documentId);
  const existing = await db.get("meta", key);
  if (!existing) return [];
  try {
    return JSON.parse(existing.value) as DocumentVersion[];
  } catch {
    return [];
  }
}

export async function removePendingSnapshot(versionId: string, documentId: string): Promise<void> {
  const db = await getLocalDB();
  const key = pendingSnapshotsKey(documentId);
  const existing = await db.get("meta", key);
  if (!existing) return;
  const list: DocumentVersion[] = JSON.parse(existing.value);
  const next = list.filter((v) => v.id !== versionId);
  if (next.length === 0) {
    await db.delete("meta", key);
  } else {
    await db.put("meta", { key, value: JSON.stringify(next) });
  }
}

export async function markOpApplied(opId: string, documentId: string): Promise<void> {
  const db = await getLocalDB();
  await db.put("appliedOps", { id: opId, documentId });
}

export async function getAppliedOpIds(documentId: string): Promise<Set<string>> {
  const db = await getLocalDB();
  const ops = await db.getAllFromIndex("appliedOps", "by-document", documentId);
  return new Set(ops.map((o) => o.id));
}

export async function queueOperation(
  operation: DocumentOperation
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    id: operation.id,
    documentId: operation.documentId,
    operation,
    status: "pending",
    retries: 0,
    createdAt: Date.now(),
  };
  await enqueueSync(item);
  return item;
}
