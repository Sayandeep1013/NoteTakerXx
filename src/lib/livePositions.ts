// Module-level live drag positions — updated 60fps during drag without touching Zustand store.
// ConnectionLayer reads from this map directly in a RAF loop.

const positions = new Map<string, { px: number; py: number }>();
let listeners: Array<() => void> = [];

export function setLivePosition(id: string, pos: { px: number; py: number } | null) {
  if (pos === null) {
    positions.delete(id);
  } else {
    positions.set(id, pos);
  }
  listeners.forEach((fn) => fn());
}

export function getLivePosition(id: string) {
  return positions.get(id);
}

export function hasAnyLivePosition() {
  return positions.size > 0;
}

export function subscribeLivePositions(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}
