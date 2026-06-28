import type { VectorClock } from "@/types";

export function incrementClock(clock: VectorClock, clientId: string): VectorClock {
  return { ...clock, [clientId]: (clock[clientId] ?? 0) + 1 };
}

export function mergeClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [clientId, tick] of Object.entries(b)) {
    merged[clientId] = Math.max(merged[clientId] ?? 0, tick);
  }
  return merged;
}

export function compareClocks(a: VectorClock, b: VectorClock): "before" | "after" | "concurrent" {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGreater = false;
  let bGreater = false;

  for (const key of allKeys) {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (av > bv) aGreater = true;
    if (bv > av) bGreater = true;
  }

  if (aGreater && !bGreater) return "after";
  if (bGreater && !aGreater) return "before";
  if (!aGreater && !bGreater) return "before";
  return "concurrent";
}

export function clockSum(clock: VectorClock): number {
  return Object.values(clock).reduce((sum, v) => sum + v, 0);
}

export function sortOperationsByCausalOrder<T extends { clock: VectorClock; clientId: string; timestamp: number }>(
  ops: T[]
): T[] {
  return [...ops].sort((a, b) => {
    const cmp = compareClocks(a.clock, b.clock);
    if (cmp === "before") return -1;
    if (cmp === "after") return 1;
    const sumDiff = clockSum(a.clock) - clockSum(b.clock);
    if (sumDiff !== 0) return sumDiff;
    const clientDiff = a.clientId.localeCompare(b.clientId);
    if (clientDiff !== 0) return clientDiff;
    return a.timestamp - b.timestamp;
  });
}
