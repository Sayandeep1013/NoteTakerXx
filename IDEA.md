# IDEA.md — NoteTakerXX: Decisions, Q&A, Mutual Understanding

## What This Is

A note-taking web app where the UI is the product. The canvas is the experience — sticky notes on a living wall. Supabase for DB + Google OAuth. Notes work offline first (localStorage), sync to DB on login.

---

## Core Concept

Real sticky notes pinned to an infinite wall. Pastel colors, paper noise texture, slight rotation. You scroll the wall like Excalidraw. Notes are freeform — no rigid grid enforcement, just grid-snapping for clean sizing.

---

## Q&A Log

### Canvas & Layout

**Q: Is the board a fixed viewport or infinite canvas?**
A: Infinite canvas. Pan in all directions (scroll vertically and horizontally). No zoom feature — fixed scale only.

**Q: Grid-based or free-form layout?**
A: Grid-based sizing (units of 80px, no fractional units, min 2×2) but freeform placement. Notes can have zero gap or 10–20 grid units between them. There is no auto-fill or reflow when a note is resized.

**Q: What happens when you try to place a note in an occupied space?**
A: Adjacent notes shift or resize by 1 grid unit to make room — BUT only if they are not locked. Locked notes are immovable.

**Q: Do adjacent notes auto-fill when a note is resized?**
A: No. The canvas is freeform — gaps between notes are fine and expected. Purely manual placement.

**Q: Where does a newly created note land?**
A: Top-left area of the current viewport — placed at the nearest free grid position. User can drag it anywhere after.

**Q: Is there a minimum note size?**
A: Yes — 2×2 grid units (160×160px). Top row = title, second row = description/content.

---

### Note Anatomy & Content

**Q: Does a note have a separate title and body?**
A: Yes. Top row is always the title. Below that is the content area (description, bullet points, to-dos, mixed).

**Q: Can a note have bullet points AND to-dos simultaneously?**
A: Yes. Both can coexist inside one note, like Obsidian/Notion blocks.

**Q: What are the key bindings for content types?**
A: `Ctrl + .` → bullet point. `Shift + .` → to-do checkbox.

**Q: What happens to text when a note is resized smaller than its content?**
A: Text is truncated with `...` to indicate hidden content. Full content visible in edit or full-screen mode.

---

### Note Controls (Mac-style header)

Each note has a header with:
- **Left cluster**: Full-screen toggle · Edit · Lock
- **Middle strip**: Hold-and-drag handle (grab anywhere here to move)
- **Right**: × Delete (with confirmation dialog)

**Lock behavior**: Prevents moving and resizing only. Reading and editing still work.

**Full-screen mode**: Opens a window/tab-style modal overlay covering the entire browser viewport. Resizable like a native OS window. Pressing the button again returns the note to its original canvas size and position.

---

### Visual Design

**Q: Sticky note aesthetic — real or flat?**
A: Real. Paper noise texture via SVG `feTurbulence` filter overlay. Slight random CSS rotation (±2°). Pastel colors.

**Q: Drop shadows?**
A: No drop shadows for now.

**Q: Note colors — random or user-chosen?**
A: Both. Randomly assigned from a curated pastel palette on creation. User can change color in edit mode.

**Q: SVG line art or CSS for note appearance?**
A: Pure CSS + inline SVG noise filter. No external assets needed.

---

### Sidebar

**Q: Is the sidebar always visible?**
A: Collapsible. User can hide/show it.

**Q: What's in the sidebar?**
A: 
- Formatting toolbar (insert bullet point, insert to-do — for users who don't know keybindings) — like Obsidian/Notion
- Profile / login section at the bottom (Google OAuth via Supabase)
- Filter section — **deferred to later phase** (logged as TODO)

---

### Onboarding

**Q: How are hints shown to new users?**
A: Two layers:
1. One-time modal on first ever visit (like Excalidraw's welcome screen) — shows key bindings, controls overview
2. Small floating tooltips that persist until dismissed

---

### Auth & Data Sync

**Q: What happens to locally cached notes when a user logs in?**
A: A prompt appears: "You have X unsaved notes. Save them to your account?" → Yes saves all to DB. No deletes them from local cache.

**Q: Same user, different device — what happens?**
A: Same flow. On login, check if the current browser has cached notes. If yes, show the same save-or-discard prompt. DB notes then load.

**Q: How is offline storage handled?**
A: `localStorage` (or `IndexedDB` if content gets large). Notes are keyed to a unique app namespace to avoid conflicts.

---

## Tech Stack Decisions

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | SSR for auth callbacks, API routes for Supabase |
| Database | Supabase (PostgreSQL) | Built-in Google OAuth, realtime, simple SDK |
| Auth | Supabase Auth + Google OAuth | Already in Supabase, no extra service |
| Canvas | Custom CSS + `@use-gesture/react` | Full control over infinite pan + note drag/resize |
| Resize/Drag | `react-rnd` or custom with `@use-gesture` | TBD during canvas prototype phase |
| Styling | Tailwind CSS + CSS custom properties | Utility-first, easy to theme pastel palette |
| Noise texture | Inline SVG `feTurbulence` filter | No assets, zero network cost |

---

## Grid System

- **1 grid unit = 80px**
- **Minimum note size = 2×2 = 160×160px**
- Notes snap to grid units on resize/place (no fractional units — 2×2, 3×4, 5×2 are valid; 2.5×4 is not)
- Canvas itself is infinite — grid extends in all directions
- No zoom — fixed scale

---

## What's Deferred (Not Now)

- Filter section in sidebar
- Mobile app (completely separate project, same Supabase DB)
- Realtime collaboration
- Note sharing / public links
