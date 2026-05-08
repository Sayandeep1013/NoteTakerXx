# TODO.md — NoteTakerXX

> Work phases in order. Complete each phase before moving to the next. Check off items as done.

---

## Phase 1 — Canvas & Note UI (Current Focus)

### Project Setup
- [ ] Initialize Next.js project (App Router, TypeScript)
- [ ] Configure Tailwind CSS
- [ ] Set up folder structure (`/components`, `/hooks`, `/lib`, `/store`)
- [ ] Add `@use-gesture/react` for drag/resize gesture handling
- [ ] Inject SVG noise filter into document root

### Infinite Canvas
- [ ] Build canvas container with pan support (mouse drag on empty canvas)
- [ ] Implement grid coordinate system (80px units)
- [ ] Add canvas origin tracking (current pan offset X/Y)
- [ ] Add scroll wheel panning (vertical + horizontal)

### Note Component — Visual Shell
- [ ] Build base Note component with pastel background + noise texture
- [ ] Implement random rotation (±2.5deg, 0.5deg steps, seeded)
- [ ] Build note header: full-screen · edit · lock · drag-handle · delete
- [ ] Style header controls (Mac-style circles, hover reveal)
- [ ] Add resize handles (8 corners/edges, grid-snap on release)
- [ ] Implement drag-to-move (straighten rotation while dragging, restore on drop)
- [ ] Implement lock state (hides resize handles, disables drag)
- [ ] Add content truncation with `...` when note is too small

### Note Component — Full-Screen Mode
- [ ] Build full-screen modal overlay (window-style, resizable within viewport)
- [ ] Animate open: scale from canvas position → centered
- [ ] Animate close: scale back to canvas position
- [ ] Rotate resets to 0 in full-screen, restores on close

### Note Creation
- [ ] Build "+" button (bottom right of viewport, fixed)
- [ ] On click: create new note at nearest free position (top-left quadrant of viewport)
- [ ] Color assigned randomly from pastel palette

### Note Placement Conflict
- [ ] Detect overlap when dropping a note onto occupied space
- [ ] Shift unlocked adjacent notes by 1 grid unit to make room
- [ ] Skip shifting locked notes (note placement fails if blocked by locked note — show brief shake/error)

### Delete Flow
- [ ] Confirmation dialog component (lightweight, note-title preview)
- [ ] Animate note out on confirm

---

## Phase 2 — Note Content & Editing

### Inline Edit Mode
- [ ] Editable title field (first row)
- [ ] Editable body (content area below)
- [ ] Plain text / paragraph blocks
- [ ] Bullet point blocks (`Ctrl + .` to insert)
- [ ] To-do checkbox blocks (`Shift + .` to insert)
- [ ] Mixed content in one note (bullets + todos + text)
- [ ] Sidebar formatting buttons trigger same insertions as keybindings (for active-focus note)
- [ ] Exit edit mode on click outside or Escape

### Color Picker in Edit Mode
- [ ] Swatch selector — 8 pastel options from palette
- [ ] Live preview on note while hovering swatches

---

## Phase 3 — Auth & Data Sync

### Supabase Setup
- [ ] Create Supabase project
- [ ] Enable Google OAuth provider in Supabase dashboard
- [ ] Set up `notes` table schema (see IDEA.md)
- [ ] Set up Row Level Security (RLS) policies

### Local Storage (Pre-login)
- [ ] Save notes to `localStorage` under namespace `nxtaker_notes`
- [ ] Full note state persisted: position, size, color, rotation, content, lock state

### Authentication Flow
- [ ] Supabase Auth client setup in Next.js
- [ ] "Sign in with Google" button in sidebar
- [ ] Auth callback route handler
- [ ] Session persistence

### Post-Login Sync
- [ ] On login: check localStorage for existing notes
- [ ] If notes found: show prompt "You have X unsaved notes. Save them?" → Yes / No
- [ ] Yes: bulk insert cached notes to DB under user ID, clear localStorage
- [ ] No: clear localStorage, load notes from DB
- [ ] Different device: same flow (check cache first, then prompt)

### CRUD via Supabase
- [ ] Create note → insert to DB
- [ ] Read notes → fetch on load (authenticated)
- [ ] Update note → upsert on every content/position change (debounced 500ms)
- [ ] Delete note → delete from DB + animate out

---

## Phase 4 — Onboarding & Polish

### Onboarding
- [ ] First-visit modal (check `nxtaker_visited` in localStorage)
- [ ] Floating tooltips: drag handle, resize corner, + button (per-key dismissal)

### Sidebar
- [ ] Collapsible sidebar with icon rail when closed
- [ ] Formatting toolbar (bullet + todo buttons, active when note is in edit mode)
- [ ] Profile section at bottom (avatar + name or sign-in button)

### UX Polish
- [ ] Note appear animation (scale + opacity on create)
- [ ] Note delete animation (scale + fade)
- [ ] Drag elevation effect (subtle lift)
- [ ] Smooth canvas pan inertia (optional)
- [ ] Keyboard: Escape closes full-screen / exits edit mode
- [ ] Focus management (newly created note auto-focuses title)

---

## Deferred (Post-MVP)

- [ ] Sidebar filter/search section
- [ ] Note tagging or categories
- [ ] Realtime sync across tabs (Supabase realtime)
- [ ] Export notes (PDF / markdown)
- [ ] Mobile app (separate project, same DB)
