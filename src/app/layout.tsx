import type { Metadata } from "next";
import { Geist, Geist_Mono, Patrick_Hand } from "next/font/google";
import ThemeSync from "@/components/ThemeSync";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const noteHand = Patrick_Hand({ variable: "--font-note-hand", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "NoteTakerXX",
  description: "Sticky notes on an infinite wall",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${noteHand.variable}`}>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
