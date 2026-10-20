import type { Metadata, Viewport } from "next";
import { Geist, Patrick_Hand } from "next/font/google";
import PreferencesSync from "@/components/PreferencesSync";
import { THEMES, DEFAULT_THEME, themeBootScript } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const noteHand = Patrick_Hand({ variable: "--font-note-hand", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "NoteTakerXX",
  description: "Sticky notes on an infinite wall",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEMES[DEFAULT_THEME].canvasBg,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${noteHand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body>
        <PreferencesSync />
        {children}
      </body>
    </html>
  );
}
