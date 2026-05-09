# NoteTakerXX 📝

An infinite canvas note-taking application built with Next.js, Supabase, and Tailwind CSS. NoteTakerXX provides a spatial, free-form environment to organize your thoughts, ideas, and tasks seamlessly.

![Canvas Overview](./public/screenshot-canvas.png) <!-- Placeholder for overview image -->

## ✨ Features

- **Infinite Spatial Canvas**: Freely pan and organize notes anywhere on a limitless grid.
- **Rich Note Modals**: Expand notes into a beautiful full-screen modal with notebook-style lined backgrounds.
- **Custom Badging**: Tag notes with built-in badges or upload custom images to categorize and filter your thoughts.
- **Note Connections**: Draw visual connection lines between related notes to build mind maps and visualize relationships.
- **Real-time Sync**: Changes are automatically synced to the cloud using Supabase, with robust offline caching capabilities.
- **Theming**: Toggle between multiple themes including a beautiful dark mode and various colorful accents.

## 📸 Screenshots

| Fullscreen Note Editing | Context Menu & Badges |
| :---: | :---: |
| ![Editing Note](./public/screenshot-edit.png) | ![Badges](./public/screenshot-badges.png) |

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Backend & Auth**: [Supabase](https://supabase.com/)
- **Gestures**: `@use-gesture/react` for smooth canvas panning and note dragging.

## 🛠️ Getting Started

### Prerequisites

You will need Node.js installed and a Supabase project set up.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Sayandeep1013/NoteTakerXx.git
   cd NoteTakerXx
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables. Create a `.env.local` file and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📜 License

This project is open-source and available under the MIT License.
