import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tajawal } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeaderGate from "@/components/HeaderGate";
import MobileNavGate from "@/components/MobileNavGate";
import MobileBottomNav from "@/components/MobileBottomNav";
import FloatingCartBar from "@/components/FloatingCartBar";
import BackBar from "@/components/BackBar";
import DeliveryLocationProvider from "@/components/DeliveryLocationProvider";
import DeliveryBanner from "@/components/DeliveryBanner";
import ChunkErrorReload from "@/components/ChunkErrorReload";
import PushOptIn from "@/components/PushOptIn";
import LocaleProvider from "@/components/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { dirFor } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Arabic glyphs — Tajawal (the family most Saudi e-commerce
// sites use) fills that gap and is listed as a fallback in globals.css'
// font stack, so it's picked up for Arabic UI without needing per-component
// font-family switching.
const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${tajawal.variable} overscroll-none font-sans antialiased bg-neutral-50 text-neutral-900`}
      >
        <ChunkErrorReload />
        <LocaleProvider locale={locale}>
        <DeliveryLocationProvider>
        <HeaderGate>
          <Header />
        </HeaderGate>
        <DeliveryBanner />
        <main className="min-h-screen">
          <BackBar />
          {children}
        </main>
        <HeaderGate>
          <div className="pb-16 md:pb-0">
            <Footer />
          </div>
        </HeaderGate>
        <MobileNavGate>
          <FloatingCartBar />
          <MobileBottomNav />
        </MobileNavGate>
        <PushOptIn />
        </DeliveryLocationProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
