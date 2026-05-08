# DEVLOG.md — NoteTakerXX

> Running log of every meaningful development decision, change, and discovery. Newest entries at the top.

---

## 2026-05-08 — Project Kickoff

**Status:** Pre-development. Docs written. Planning complete.

**Decisions locked in today:**
- Tech stack: Next.js (App Router) + Supabase + Tailwind + `@use-gesture/react`
- Grid: 80px units, min 2×2 note, no fractional sizes, freeform placement
- No auto-fill on resize — infinite canvas, manual placement
- Conflict resolution: adjacent unlocked notes shift 1 grid unit on overlap
- Auth flow: localStorage-first, post-login sync prompt
- Visual: pastel notes, SVG noise texture, ±2.5deg rotation, no drop shadows
- Full-screen: window-style overlay, resizable, origin-aware animation
- Sidebar: collapsible, formatting tools (bullets/todos), profile at bottom

**Starting with:** Phase 1 — Canvas prototype. No DB, no auth yet. Prove the canvas and note UI work first.

**Open questions going into Phase 1:**
- `react-rnd` vs custom `@use-gesture/react` for resize/drag — evaluate during prototype
- Grid snap feel: snap on drag or snap on release? (lean toward snap on release for freeform feel)

---

## 2026-05-09 — Phase 1 Final Polish

**Fixed:**
- Note spawn now excludes sidebar area — `addNote` reads `sidebarOpen` from store and offsets `vLeft` by sidebar width before scanning for a free slot
- Ball radius reduced: 180px → 80px (diameter ~160px, much tighter)
- Sidebar made floating: `position: fixed` with 12px margin on all sides, `borderRadius: 16px`, glassmorphism background (`backdrop-filter: blur(20px)` + semi-transparent fill), drop shadow. Adapts fill/border per theme.
- Sidebar open/close state moved to Zustand store (`sidebarOpen`, `setSidebarOpen`) so `addNote` can read it

## 2026-05-08 — Canvas & Note Iteration

**Fixed:**
- Dot grid: spacing 80px → 40px; base dot opacity raised so resting dots are visible
- Infinite pan wall: pan-layer moved outside canvas-world so it always fills viewport; canvas-world gets `pointer-events: none`, notes re-enable with `pointer-events: auto`
- Note drag wall: removed all `Math.max(0, ...)` clamps — notes can go to negative coordinates
- Initial canvas pan set to (320, 240) giving space to pan up/left from origin
- Min note size: 2×2 → 4×4 grid units
- Fullscreen modal: was broken by CSS transform stacking context — fixed with `createPortal`
- Fullscreen animation: Mac-like origin-aware scale. Opens from note center → viewport center (spring cubic-bezier). Closes center → note center (reverse)
- Fullscreen window is now resizable via 8 edge/corner handles
- Light theme is now default (warm off-white canvas, vibrant pastels). Dark mode uses deep jewel-tone pastels on #141414 canvas
- Note text color adapts per theme (dark text on light notes, light text on dark notes)
- `useTheme` hook + `lib/colors.ts` for centralized theme-aware color system

<!-- Add new entries above this line, newest first -->
