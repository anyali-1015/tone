import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FindPhraseProvider } from "@/components/FindPhrase";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tone",
  description: "Sound like a native: real videos in, real conversations out.",
};

// Applies the saved theme before paint so "Dusk" doesn't flash.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('tone.settings')||'{}');if(s.theme&&s.theme!=='auto')document.documentElement.setAttribute('data-theme',s.theme)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <FindPhraseProvider>{children}</FindPhraseProvider>
      </body>
    </html>
  );
}
