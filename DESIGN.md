# DESIGN.md — NoteTakerXX Design Source of Truth

> This is the single source of truth for all design decisions. All component styling, spacing, color, and motion must trace back to a decision recorded here.

---

## Design Philosophy

**"Real sticky notes on a living wall."**

The UI *is* the product. Every design decision should reinforce the tactile, physical metaphor: paper texture, pastel warmth, slight imperfection (rotation), and spatial freedom. The canvas should feel like a real surface you can reach into.

---

## Color System

### Pastel Note Palette

Each note is randomly assigned one of these on creation. User can override in edit mode.

```
--note-yellow:  #FFF3A3
--note-pink:    #FFD6E0
--note-mint:    #C3F5E0
--note-lavender:#E4D4F4
--note-peach:   #FFE0C8
--note-sky:     #C8E8FF
--note-lilac:   #F0D4FF
--note-sage:    #D4EDD4
```

### App Chrome (Canvas & UI)

```
--bg-canvas:    #1A1A1A       /* dark wall the notes sit on */
--bg-sidebar:   #111111
--text-primary: #1A1A1A       /* on note surface */
--text-muted:   #666666
--text-ui:      #E0E0E0       /* on dark chrome */
--accent:       #5C6BC0       /* interactive elements, focus rings */
--danger:       #E57373       /* delete confirm */
```

### Note Surface Contrast

All text on notes uses `--text-primary` (#1A1A1A). Ensure minimum 4.5:1 contrast ratio against all pastel backgrounds — all palette values above pass this.

---

## Typography

```
Font family:    'Geist', 'Inter', system-ui, sans-serif
Note title:     16px / font-weight 600 / line-height 1.3
Note body:      14px / font-weight 400 / line-height 1.6
UI labels:      12px / font-weight 500 / letter-spacing 0.02em
Sidebar items:  14px / font-weight 400
```

Monospace for to-do and bullet list indicators:
```
Checkboxes/bullets: 'Geist Mono', 'Fira Code', monospace / 13px
```

---

## Grid System

```
Grid unit:        80px × 80px
Minimum note:     2 × 2 = 160px × 160px
Snap behavior:    Notes snap to grid on release (resize & drag)
Fractional units: NOT ALLOWED (2.5×4, 4×4.5 are invalid)
Gap between notes: 0 to any number of units — freeform, user decides
```

**Layout anatomy of a 2×2 note:**
```
┌──────────────────────────────┐  ← row 1: note header (controls)
│ ● ✎ 🔒  ══════════════  ✕   │
├──────────────────────────────┤  ← row 2: title
│ Note Title                   │
├──────────────────────────────┤  ← row 3+: content
│ Description / bullets / todos│
└──────────────────────────────┘
```

For a 2×2 note (160px tall):
- Header: 32px
- Title row: 36px
- Content: 92px (remaining)

For larger notes, title stays fixed, content area grows.

---

## Note Anatomy

### Header (always 32px tall)

```
[ ● ][ ✎ ][ 🔒 ]  [ ══ drag handle ══ ]  [ ✕ ]
  12px circles        flex-grow            12px circle
```

**Left controls (12px circles, spaced 6px apart):**
- **●** Full-screen toggle — expands note to full browser viewport window
- **✎** Edit — enters inline edit mode (or full-screen edit if note is in full-screen)
- **🔒** Lock — toggles locked state (prevents drag and resize only)

**Middle:** Drag handle strip. `cursor: grab`. Hold and drag to reposition.

**Right:** **✕** Delete — opens confirmation dialog.

### Header visual states

```
Default:        controls visible at 60% opacity on hover, 0% at rest
Hover on note:  controls fade in (200ms ease)
Locked:         🔒 icon filled/highlighted, resize handles hidden
Edit mode:      border pulses with --accent color
```

### Note Body

Content area scrolls internally if content exceeds visible area.

Truncation rule: if a note's content area is too small to show all text, clip at last fully visible line and append `...` (CSS `overflow: hidden` + `-webkit-line-clamp`). Full content always accessible via edit or full-screen.

---

## Texture & Noise

**Implementation:** Inline SVG `feTurbulence` filter applied as a pseudo-element overlay.

```css
.note::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0.08;
  filter: url(#paper-noise);
  pointer-events: none;
  mix-blend-mode: multiply;
}
```

SVG noise definition (injected once into the document body):
```svg
<svg style="display:none">
  <filter id="paper-noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
</svg>
```

Adjust `opacity` per note color — lighter pastels may need 0.06, deeper ones 0.10.

---

## Note Rotation

Each note gets a seeded random rotation on creation, stored as part of note data.

```
Range:    -2.5deg to +2.5deg
Step:     0.5deg increments only (so: -2.5, -2.0, -1.5 ... +2.0, +2.5)
Behavior: Fixed after creation. Does not change on edit or resize.
          Locked notes retain rotation.
          Full-screen mode: rotation resets to 0 during overlay, restores on close.
```

---

## Resize Handles

Resize handles appear on all 4 corners and 4 edges (8 total) on hover.

```
Size:       8px × 8px
Style:      Rounded square, --accent color, 80% opacity
Visibility: 0% at rest, 100% on note hover (unless locked)
Cursor:     nw-resize, n-resize, ne-resize, etc. (appropriate per handle)
Snap:       On mouse-up, snap to nearest grid unit boundary
```

---

## Full-Screen Mode

When activated, the note opens as a window-style overlay:

```
Backdrop:      rgba(0,0,0,0.6) blur(4px)
Window:        White or note's pastel color, 85vw × 85vh, centered
Border-radius: 12px
Window controls: Same header (●/✎/🔒/✕) but ● now = "restore to canvas"
Resize:        Window is resizable (like native OS window) within the viewport
Animation:     Scale from note's canvas position → center (300ms ease-out)
               Reverse on close (300ms ease-in)
```

---

## Sidebar

```
Width (open):    240px
Width (closed):  48px (icon rail only)
Background:      --bg-sidebar
Transition:      width 220ms ease
Position:        Fixed left edge, full height
```

### Sidebar Sections (top to bottom)

1. **Collapse toggle** (top, always visible)
2. **Formatting tools** — bullet point insert, to-do insert (active when a note is in edit mode)
3. **[Spacer / future: filters]**
4. **Profile section** (bottom) — avatar + name if logged in, or "Sign in with Google" button

---

## Onboarding

### First-Visit Modal

Shown once on first ever visit (tracked in localStorage `nxtaker_visited`).

```
Style:       Centered modal, --bg-sidebar background, 480px wide
Content:     App name + tagline + 5-6 key controls overview
             (drag to move, resize corners, keybindings, lock, full-screen)
Dismiss:     "Got it" button or press Escape
```

### Floating Tooltips

Small tooltip bubbles that appear near relevant UI elements until dismissed individually.

```
Style:       Dark pill tooltip (--bg-sidebar, white text, 12px)
Persistence: Each tooltip has its own localStorage key
             Dismissed per-tooltip, not all at once
Triggers:    First time user hovers over: drag handle, resize corner, + button
```

---

## Confirmation Dialog (Delete)

```
Style:       Small centered modal, not full-overlay — feels lightweight
Content:     "Delete this note?" + note title preview
Buttons:     "Cancel" (ghost) / "Delete" (--danger fill)
Animation:   Fade + slight scale (150ms)
```

---

## Animations & Motion

```
Note appear (create):     Scale from 0.8 → 1.0, opacity 0 → 1 (200ms ease-out)
Note delete:              Scale 1.0 → 0.8, opacity 1 → 0 (180ms ease-in)
Note drag:                Drop shadow appears (elevation effect), rotation straightens to 0 while dragging, restores on drop
Sidebar open/close:       Width transition (220ms ease)
Full-screen open/close:   Origin-aware scale (300ms ease)
Control hover:            Opacity 200ms ease
```

**Drag rotation behavior:** While actively dragging, note rotation transitions to 0deg (feels like you're picking it up). On drop, it snaps back to its stored rotation.

---

## Z-Index Stack

```
Canvas notes (default):   10
Note being dragged:       100
Full-screen backdrop:     200
Full-screen window:       210
Sidebar:                  300
Onboarding modal:         400
Confirmation dialog:      400
Floating tooltips:        350
```

---

## Responsive / Platform

Desktop-first. Minimum supported width: 1024px. No mobile layout planned for this app (separate mobile app is a future project on the same DB).
