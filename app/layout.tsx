import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://opryn.app"),
  title: "Opryn — Teach Your Business Once. Knowledge for People and AI.",
  description:
    "One approved source of company knowledge for employees, new hires, ChatGPT, Claude, and the AI tools you already use.",
  openGraph: {
    title: "Opryn — Teach Your Business Once. Knowledge for People and AI.",
    description:
      "Teach Opryn once. Give your team and connected tools trusted company answers without constant owner interruptions.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
