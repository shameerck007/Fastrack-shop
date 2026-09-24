import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import HeaderGate from "@/components/HeaderGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FasTrack Shop — Everything you need. Delivered.",
  description: "Quick-commerce grocery delivery for Riyadh, Saudi Arabia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-50 text-neutral-900`}>
        <HeaderGate>
          <Header />
        </HeaderGate>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
