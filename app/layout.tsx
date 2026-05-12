import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BrowserTranslate — Free, Private, On-Device Translation",
  description:
    "Translate 200+ languages directly in your browser. No API key, no tracking, completely free. Powered by Meta NLLB-200.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
