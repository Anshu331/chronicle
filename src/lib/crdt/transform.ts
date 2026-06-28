import type { DocumentOperation } from "@/types";

/**
 * Operational Transformation: adjust `op` positions after `against` was applied first.
 * Used when integrating remote ops alongside local pending ops.
 */
export function transformOperation(
  op: DocumentOperation,
  against: DocumentOperation
): DocumentOperation {
  if (op.id === against.id) return op;

  let position = op.position;

  if (against.type === "insert" && against.text !== undefined) {
    const insPos = against.position;
    const insLen = against.text.length;

    if (op.type === "insert") {
      if (insPos <= position) position += insLen;
    } else if (op.type === "delete" && op.length !== undefined) {
      if (insPos <= position) {
        position += insLen;
      } else if (insPos < position + op.length) {
        return { ...op, length: op.length + insLen };
      }
    }
  } else if (against.type === "delete" && against.length !== undefined) {
    const delPos = against.position;
    const delLen = against.length;
    const delEnd = delPos + delLen;

    if (op.type === "insert") {
      if (delEnd <= position) {
        position -= delLen;
      } else if (delPos < position) {
        position = delPos;
      }
    } else if (op.type === "delete" && op.length !== undefined) {
      const opEnd = position + op.length;
      if (delEnd <= position) {
        position -= delLen;
      } else if (delPos >= opEnd) {
        // no overlap
      } else if (delPos <= position && delEnd >= opEnd) {
        return { ...op, length: 0 };
      } else if (delPos <= position && delEnd < opEnd) {
        return { ...op, position: delPos, length: opEnd - delEnd };
      } else if (delPos > position && delEnd >= opEnd) {
        return { ...op, length: delPos - position };
      } else {
        return { ...op, length: 0 };
      }
    }
  }

  if (position === op.position) return op;
  return { ...op, position: Math.max(0, position) };
}

export function transformOpAgainstOps(
  op: DocumentOperation,
  priorOps: DocumentOperation[]
): DocumentOperation {
  return priorOps.reduce((acc, against) => transformOperation(acc, against), op);
}
