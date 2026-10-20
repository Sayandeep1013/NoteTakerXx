// Module-level live geometry for items being dragged or resized. Updated at
// pointer rate without touching the Zustand store; ConnectionLayer subscribes
// so ropes/arrows follow the item in real time.

export interface LiveRect {
  px: number;
  py: number;
  pw?: number;
  ph?: number;
}

const positions = new Map<string, LiveRect>();
const listeners = new Set<() => void>();

export function setLivePosition(id: string, rect: LiveRect | null) {
  if (rect === null) positions.delete(id);
  else positions.set(id, rect);
  listeners.forEach((fn) => fn());
}

export function getLivePosition(id: string) {
  return positions.get(id);
}

export function subscribeLivePositions(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
