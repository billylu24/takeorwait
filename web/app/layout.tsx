import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";

import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "TakeOrWait · UCSB course decisions", template: "%s · TakeOrWait" },
  description:
    "Does the instructor matter for this UCSB course, and where does each instructor sit? Era-adjusted A-rates with 90% intervals, from Registrar data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
