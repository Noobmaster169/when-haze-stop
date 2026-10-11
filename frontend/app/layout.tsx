import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

import { InlineScript } from "@/components/ui/inline-script";
import { SCHEME_SCRIPT } from "@/lib/scheme-script";

import "./globals.css";

/*
 * Three families. Newsreader carries one display line per page; Inter stays
 * neutral under it; JetBrains Mono sets every id, count and tool name.
 */
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "When Haze Stop",
  description: "Haze over Malaysia: readings now, a forecast three and a half days ahead, alerts, and an assistant that reads the same data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script sets data-theme on <html> before React hydrates; suppressHydrationWarning lets that attribute stand.
    <html lang="en" className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <InlineScript html={SCHEME_SCRIPT} />
      </head>
      <body className="font-sans text-body text-ink">{children}</body>
    </html>
  );
}
