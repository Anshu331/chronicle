import type { DocumentOperation } from "@/types";
import { applyOperation } from "./operations";
import { transformOpAgainstOps } from "./transform";
import { mergeClocks, sortOperationsByCausalOrder } from "./vector-clock";

export interface MergeResult {
  content: string;
  clock: ReturnType<typeof mergeClocks>;
  appliedOps: DocumentOperation[];
}

export function dedupeOperations(ops: DocumentOperation[]): DocumentOperation[] {
  const map = new Map<string, DocumentOperation>();
  for (const op of ops) {
    map.set(op.id, op);
  }
  return [...map.values()];
}

/**
 * Rebuild document content deterministically from the full operation log (genesis state).
 * Prevents double-application when server/client content already reflects prior merges.
 */
export function rebuildFromOperations(ops: DocumentOperation[]): MergeResult {
  return mergeDocumentState("", {}, dedupeOperations(ops), [], new Set());
}

/**
 * Deterministic conflict resolution: apply all operations in causal order.
 * Concurrent ops are ordered by clock sum → clientId → timestamp (stable tie-break).
 */
export function mergeDocumentState(
  baseContent: string,
  baseClock: Record<string, number>,
  localOps: DocumentOperation[],
  remoteOps: DocumentOperation[],
  alreadyAppliedIds: Set<string> = new Set()
): MergeResult {
  const allOps = dedupeOperations([...localOps, ...remoteOps]).filter(
    (op) => !alreadyAppliedIds.has(op.id)
  );
  const sorted = sortOperationsByCausalOrder(allOps);

  let content = baseContent;
  let clock = { ...baseClock };

  for (const op of sorted) {
    if (op.type === "delete" && op.length === 0) continue;
    content = applyOperation(content, op);
    clock = mergeClocks(clock, op.clock);
  }

  return { content, clock, appliedOps: sorted };
}

/**
 * Merge remote ops against local pending ops using OT, then apply on top of base state.
 */
export function mergeRemoteWithPending(
  baseContent: string,
  baseClock: Record<string, number>,
  pendingOps: DocumentOperation[],
  remoteOps: DocumentOperation[],
  alreadyAppliedIds: Set<string> = new Set()
): MergeResult {
  const transformedRemote = remoteOps
    .filter((op) => !alreadyAppliedIds.has(op.id))
    .map((op) => transformOpAgainstOps(op, pendingOps));

  return mergeDocumentState(baseContent, baseClock, pendingOps, transformedRemote, alreadyAppliedIds);
}
