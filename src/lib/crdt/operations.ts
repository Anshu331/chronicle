import { nanoid } from "nanoid";
import type { DocumentOperation, VectorClock } from "@/types";
import { incrementClock } from "./vector-clock";

export function applyOperation(content: string, op: DocumentOperation): string {
  const pos = Math.min(Math.max(0, op.position), content.length);

  if (op.type === "insert" && op.text !== undefined) {
    return content.slice(0, pos) + op.text + content.slice(pos);
  }

  if (op.type === "delete" && op.length !== undefined) {
    const end = Math.min(pos + op.length, content.length);
    return content.slice(0, pos) + content.slice(end);
  }

  return content;
}

export function createInsertOp(
  documentId: string,
  clientId: string,
  clock: VectorClock,
  position: number,
  text: string,
  userId: string
): { operation: DocumentOperation; newClock: VectorClock } {
  const newClock = incrementClock(clock, clientId);
  return {
    operation: {
      id: nanoid(),
      documentId,
      clientId,
      clock: newClock,
      type: "insert",
      position,
      text,
      userId,
      timestamp: Date.now(),
    },
    newClock,
  };
}

export function createDeleteOp(
  documentId: string,
  clientId: string,
  clock: VectorClock,
  position: number,
  length: number,
  userId: string
): { operation: DocumentOperation; newClock: VectorClock } {
  const newClock = incrementClock(clock, clientId);
  return {
    operation: {
      id: nanoid(),
      documentId,
      clientId,
      clock: newClock,
      type: "delete",
      position,
      length,
      userId,
      timestamp: Date.now(),
    },
    newClock,
  };
}

export function computeDiff(
  oldContent: string,
  newContent: string
): Array<{ type: "insert" | "delete"; position: number; text?: string; length?: number }> {
  if (oldContent === newContent) return [];

  let prefix = 0;
  const minLen = Math.min(oldContent.length, newContent.length);
  while (prefix < minLen && oldContent[prefix] === newContent[prefix]) prefix++;

  let oldSuffix = oldContent.length;
  let newSuffix = newContent.length;
  while (
    oldSuffix > prefix &&
    newSuffix > prefix &&
    oldContent[oldSuffix - 1] === newContent[newSuffix - 1]
  ) {
    oldSuffix--;
    newSuffix--;
  }

  const ops: Array<{ type: "insert" | "delete"; position: number; text?: string; length?: number }> = [];
  const deleteLen = oldSuffix - prefix;
  const insertText = newContent.slice(prefix, newSuffix);

  if (deleteLen > 0) {
    ops.push({ type: "delete", position: prefix, length: deleteLen });
  }
  if (insertText.length > 0) {
    ops.push({ type: "insert", position: prefix, text: insertText });
  }

  return ops;
}
