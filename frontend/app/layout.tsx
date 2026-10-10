import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

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
    <html lang="en" className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans text-body text-ink">{children}</body>
    </html>
  );
}
