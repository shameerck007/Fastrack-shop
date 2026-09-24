import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import HeaderGate from "@/components/HeaderGate";
import MobileNavGate from "@/components/MobileNavGate";
import MobileBottomNav from "@/components/MobileBottomNav";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FasTrack Shop",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} overscroll-none antialiased bg-neutral-50 text-neutral-900`}>
        <HeaderGate>
          <Header />
        </HeaderGate>
        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
        <MobileNavGate>
          <MobileBottomNav />
        </MobileNavGate>
      </body>
    </html>
  );
}
