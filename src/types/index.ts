export type DocumentRole = "owner" | "editor" | "viewer";

export interface VectorClock {
  [clientId: string]: number;
}

export interface DocumentOperation {
  id: string;
  documentId: string;
  clientId: string;
  clock: VectorClock;
  type: "insert" | "delete";
  position: number;
  text?: string;
  length?: number;
  userId: string;
  timestamp: number;
}

export interface DocumentState {
  id: string;
  title: string;
  content: string;
  clock: VectorClock;
  role: DocumentRole;
  ownerId: string;
  updatedAt: string;
  localOnly?: boolean;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  content: string;
  clock: VectorClock;
  label?: string;
  createdBy: string;
  createdAt: string;
  isSnapshot: boolean;
}

export interface SyncQueueItem {
  id: string;
  documentId: string;
  operation: DocumentOperation;
  status: "pending" | "syncing" | "failed";
  retries: number;
  createdAt: number;
}

export interface SyncPayload {
  documentId: string;
  operations: DocumentOperation[];
  clientClock: VectorClock;
  clientId: string;
}

export interface SyncResponse {
  operations: DocumentOperation[];
  serverClock: VectorClock;
  content: string;
  merged: boolean;
}
