import { useNotesStore, type Note } from "@/store/notes";
import { detectLine } from "@/lib/noteText";

export function itemLabel(item: Note) {
  if (item.type === "folder") return item.folderName?.trim() || item.title.trim() || "Untitled Folder";
  if (item.type === "photo") return item.caption?.trim() || item.body.trim() || "Untitled Photo";
  return item.title.trim() || item.body.trim().split("\n")[0] || "Untitled";
}

export function itemSnippet(item: Note) {
  return (item.type === "photo" ? item.caption ?? "" : item.type === "folder" ? "" : item.body).trim();
}

/** First non-empty line of the snippet with list markers stripped, for one-line previews. */
export function itemPreview(item: Note) {
  const line = itemSnippet(item).split("\n").find((l) => l.trim()) ?? "";
  return detectLine(line).content.trim();
}

/** Strokes are canvas ink, not "items" a user searches for or counts. */
export const isListable = (item: Note) => item.type !== "stroke";

/**
 * Pointer-down behaviour shared by every canvas item while a tool mode is active
 * (import/multi-select, badge placement, rope connecting). Returns true when the
 * press was consumed and the item should not start its own interaction.
 */
export function handleItemModePointer(id: string, e: React.PointerEvent, opts: { connectable: boolean }) {
  const s = useNotesStore.getState();
  if (s.selectionMode === "import" || e.ctrlKey || e.metaKey) {
    s.toggleSelectedItem(id);
    return true;
  }
  if (s.badgeMode && opts.connectable) {
    s.toggleNoteBadge(id, s.badgeMode);
    s.setBadgeMode(null);
    return true;
  }
  if (opts.connectable && (s.ropeMode || e.shiftKey)) {
    if (s.connectionMode && s.connectionMode !== id) {
      s.addConnection(s.connectionMode, id, "#e74c3c", "rope");
      s.setConnectionMode(null);
    } else {
      s.setConnectionMode(s.connectionMode === id ? null : id);
    }
    return true;
  }
  return false;
}
