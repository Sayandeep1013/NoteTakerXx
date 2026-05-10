# NoteTakerXX

NoteTakerXX is a spatial note-taking app built around an infinite canvas. Instead of keeping notes in a flat list, it lets you place sticky notes anywhere, move them around, connect related ideas, tag them with badges, and jump back to what you need through search.

![NoteTakerXX canvas overview](<images/Readme Screenshot Images/overall screenshot of page.png>)

## Features

- Infinite free-form canvas with a reactive dot-grid background.
- Smooth canvas panning with mouse drag and wheel/trackpad movement.
- Floating sticky notes with title, body, note color, rotation, and z-index layering.
- Smart note placement that tries to create new notes in an open visible spot.
- Drag notes around the canvas with grid-aligned positioning.
- Resize notes with a visible resize handle.
- Rotate notes by dragging the rotation handle, or click the handle to reset rotation.
- Lock and unlock notes to prevent accidental moving or editing.
- Delete notes with a confirmation modal.
- Bring notes to the front automatically when selected.
- Auto-focus newly created notes so writing can start immediately.
- Inline note editing with debounced saves.
- Full-screen note view with animated expansion from the canvas.
- Resizable full-screen note modal.
- Notebook-style lined-paper note backgrounds.
- Adjustable note text size from both compact and full-screen views.
- Rich lightweight text patterns:
  - Bullets with `- `, `. `, or bullet-style input.
  - Numbered lists with automatic continuation.
  - Todo items with `[ ] ` and `[x] `.
  - Clickable todo checkboxes in read mode.
  - Smart Enter and Backspace handling for formatted lines.
  - Keyboard shortcuts for bullets and todos.
- Visual note connections using rope-style curved lines.
- Shift-click connection workflow for linking two notes.
- Connection preview while choosing a target note.
- Click existing connection lines to remove them.
- Built-in badge system for categorizing notes.
- Built-in Favorite, Hot, and Done badges.
- Custom badge uploads from local images.
- Add or remove badges from the dock or the note context menu.
- Badge filtering to show only matching notes.
- Custom badge deletion with confirmation and automatic removal from affected notes.
- Dock-style bottom toolbar with compact and expanded states.
- Theme picker with six themes: Paper, Cork Board, Slate, Midnight, Forest, and Dusk.
- Theme persistence through local storage and the signed-in user's Supabase profile.
- Global command-palette search with `Ctrl+Shift+P` / `Cmd+Shift+P`.
- Dock search panel for quickly finding and navigating to notes.
- Search result navigation that centers the selected note and highlights it.
- Profile modal with account information, note list, note search, and badge filtering.
- Google OAuth sign-in through Supabase.
- Guest/local note persistence through `localStorage`.
- Cloud note sync for signed-in users through Supabase.
- User-specific local cache for faster recovery and offline resilience.
- Merge prompt for saving guest notes to an account after sign-in.
- Supabase profile storage for usernames, avatars, themes, and custom badges.
- Avatar upload through Supabase Storage.
- Coffee/support QR modal with a toggle to hide or show the coffee button.
- Persisted canvas pan position.
- Persisted coffee-button preference.
- Lightweight FPS and memory monitor.
- Responsive HUD scaling for smaller screens.
- Handwritten sticky-note typography using the Patrick Hand font.

## Screenshots

### Canvas Workspace

The main workspace is an infinite canvas with sticky notes, a dock, badges, search/filter controls, and quick note creation.

![Canvas workspace](<images/Readme Screenshot Images/overall screenshot of page.png>)

### Full-Screen Note Modal

Any note can be expanded into a larger writing surface with the same lined-paper look, editable content, text-size controls, and resizing.

![Full-screen note modal](<images/Readme Screenshot Images/fullscreen modal of a note.png>)

### Universal Search

Use the global search overlay to find notes by title or body, jump to the result, bring it forward, and highlight it on the canvas.

![Universal search](<images/Readme Screenshot Images/universal search.png>)

### Profile And Notes

The profile modal includes account details, avatar upload, username editing, note stats, a searchable note list, badge filters, and sign-out controls.

![Profile modal](<images/Readme Screenshot Images/Profile modal.png>)

## Tech Stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand for client-side state
- Supabase Auth, Database, Storage, and SSR helpers
- `@use-gesture/react` for drag interactions
- `nanoid` for generated IDs

## Project Structure

```text
src/
  app/                  Next.js routes and global layout
  components/           Canvas, notes, dock, modals, search, and visual layers
  hooks/                Auth, sync, profile, theme, and HUD scaling hooks
  lib/                  Theme, badge, color, and Supabase helpers
  store/                Zustand note/canvas state
supabase/
  schema.sql            Database, RLS, profile, and avatar bucket setup
images/
  Readme Screenshot Images/
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project
- Google OAuth configured in Supabase if you want Google sign-in

### Installation

1. Clone the repository.

```bash
git clone https://github.com/Sayandeep1013/NoteTakerXx.git
cd NoteTakerXx
```

2. Install dependencies.

```bash
npm install
```

3. Create `.env.local` in the project root.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the Supabase schema.

Open the Supabase SQL Editor and run the SQL in:

```text
supabase/schema.sql
```

This creates the `notes` and `profiles` tables, row-level security policies, profile creation trigger, and the public `avatars` storage bucket.

5. Start the development server.

```bash
npm run dev
```

6. Open the app.

[http://localhost:3000](http://localhost:3000)

## Supabase Notes

The app works as a guest app with local storage, but sign-in and cloud sync require Supabase. The schema includes:

- `notes` table for canvas notes, position, dimensions, color, rotation, lock state, content, font size, badges, and timestamps.
- `profiles` table for username, avatar URL, theme, and custom badges.
- RLS policies so users can only modify their own notes and profiles.
- `avatars` storage bucket for profile images.

For Google sign-in, add your app URL to the Supabase Auth redirect URLs. In development, include:

```text
http://localhost:3000/auth/callback
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Keyboard And Mouse Controls

- Drag the empty canvas to pan.
- Use wheel or trackpad scrolling to pan the canvas.
- Click `+` to create a note.
- Drag a note header handle to move a note.
- Drag the resize handle to resize a note.
- Drag the rotation handle to rotate a note.
- Click the rotation handle to reset rotation.
- Shift-click one note, then Shift-click another note to connect them.
- Press `Esc` to cancel connection mode or close active edit/modal states.
- Use `Ctrl+Shift+P` or `Cmd+Shift+P` to open universal search.
- In note body editing, use `Ctrl+.` / `Cmd+.` for bullets.
- In note body editing, use `Ctrl+/` / `Cmd+/` for todos.

## Current Limitations

- Note content syncs to Supabase, while visual note connections currently live in the client state for the active session.
- Guest data is stored in the browser's local storage, so it is tied to that browser profile until merged into an account.
