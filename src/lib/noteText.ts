// Lightweight "markdown-ish" line formatting shared by the inline note editor
// and the fullscreen editor.

export type LineType = "bullet" | "todo-open" | "todo-done" | "numbered" | "plain";

export interface ParsedLine {
  type: LineType;
  content: string;
  num?: number;
}

export function detectLine(line: string): ParsedLine {
  if (line.startsWith("- ") || line.startsWith(". ") || line.startsWith("• ")) return { type: "bullet", content: line.slice(2) };
  if (line.startsWith("[ ] ")) return { type: "todo-open", content: line.slice(4) };
  if (line.startsWith("[x] ")) return { type: "todo-done", content: line.slice(4) };
  const m = line.match(/^(\d+)\. (.*)/);
  if (m) return { type: "numbered", content: m[2], num: parseInt(m[1], 10) };
  return { type: "plain", content: line };
}

function continuation(line: string): string | null {
  const { type, num } = detectLine(line);
  if (type === "bullet") return "- ";
  if (type === "todo-open" || type === "todo-done") return "[ ] ";
  if (type === "numbered" && num !== undefined) return `${num + 1}. `;
  return null;
}

/** Strip any list prefix from the start of a line. */
function stripPrefix(line: string) {
  const { type } = detectLine(line);
  if (type === "bullet") return line.slice(2);
  if (type === "todo-open" || type === "todo-done") return line.slice(4);
  const m = line.match(/^\d+\. /);
  return m ? line.slice(m[0].length) : line;
}

export interface TextEdit {
  text: string;
  cursor: number;
}

/** Toggle `prefix` on the line containing `pos` (replacing other list prefixes). */
export function toggleLinePrefix(text: string, pos: number, prefix: string): TextEdit {
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const rest = text.substring(lineStart);
  if (rest.startsWith(prefix)) {
    return {
      text: text.substring(0, lineStart) + text.substring(lineStart + prefix.length),
      cursor: Math.max(lineStart, pos - prefix.length),
    };
  }
  return {
    text: text.substring(0, lineStart) + prefix + stripPrefix(rest),
    cursor: lineStart + prefix.length,
  };
}

/** Flip a `[ ]` / `[x]` todo on the given line index. */
export function toggleTodoAt(body: string, lineIndex: number): string {
  const lines = body.split("\n");
  const l = lines[lineIndex] ?? "";
  if (l.startsWith("[ ] ")) lines[lineIndex] = "[x] " + l.slice(4);
  else if (l.startsWith("[x] ")) lines[lineIndex] = "[ ] " + l.slice(4);
  return lines.join("\n");
}

/**
 * Smart list editing for a textarea key press. Returns the edit to apply, or
 * null if the browser should handle the key normally.
 */
export function listKeyEdit(
  key: string,
  mod: boolean,
  text: string,
  selStart: number,
  selEnd: number,
): TextEdit | null {
  if (mod && key === ".") return toggleLinePrefix(text, selStart, "- ");
  if (mod && key === "/") return toggleLinePrefix(text, selStart, "[ ] ");

  const lineStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const currentLine = text.substring(lineStart, selStart);

  if (key === "Enter" && !mod) {
    const cont = continuation(currentLine);
    if (cont === null) return null;
    if (!detectLine(currentLine).content.trim()) {
      // Enter on an empty list item ends the list.
      return { text: text.substring(0, lineStart) + text.substring(selStart), cursor: lineStart };
    }
    const ins = "\n" + cont;
    return { text: text.substring(0, selStart) + ins + text.substring(selEnd), cursor: selStart + ins.length };
  }

  if (key === "Backspace" && selStart === selEnd) {
    const { type, content } = detectLine(currentLine);
    if (type !== "plain" && !content.trim() && selStart === lineStart + currentLine.length) {
      return { text: text.substring(0, lineStart) + text.substring(selStart), cursor: lineStart };
    }
  }

  return null;
}
