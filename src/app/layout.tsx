import { Suspense } from "react";
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
import StoreDirectoryProvider from "@/components/StoreDirectoryProvider";
import CustomerStateProvider from "@/components/CustomerStateProvider";
import MarketSuggestionBanner from "@/components/MarketSuggestionBanner";
import MarketToast from "@/components/MarketToast";
import NavProgress from "@/components/NavProgress";
import { getCompanySettings } from "@/lib/company-settings";
import { DEFAULT_ETA_SETTINGS } from "@/lib/eta";
import MoneyProvider from "@/components/MoneyProvider";
import { getCurrentTenant, getMarketSuggestion } from "@/lib/tenant-server";
import DefaultCountryProvider from "@/components/DefaultCountryProvider";
import { getRequestCountryCode } from "@/lib/get-request-country";
import { cookies } from "next/headers";
import { TENANT_COOKIE } from "@/lib/tenant";
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
  description: "Quick-commerce grocery delivery to your door.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FasTrack Shop",
    // iPhone launch screens: the FasTrack logo on white instead of a blank page while the app starts.
    startupImage: [
      { url: "/splash/1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/splash/1242x2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }
    ],
  },
  // Stops phones that force dark mode from painting the page black before our styles load.
  other: { "color-scheme": "light" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  const ipCountry = await getRequestCountryCode();
  const marketSuggestion = await getMarketSuggestion().catch(() => null);
  const tenant = await getCurrentTenant().catch(() => null);
  const currency = tenant?.currency ?? "SAR";
  const marketCountry = tenant?.country_code ?? "SA";
  const company = await getCompanySettings().catch(() => null);
  const etaSettings = {
    prepMinutes: Number(company?.prep_minutes ?? DEFAULT_ETA_SETTINGS.prepMinutes),
    speedKmh: Number(company?.rider_speed_kmh ?? DEFAULT_ETA_SETTINGS.speedKmh),
    bufferMinutes: Number(company?.eta_buffer_minutes ?? DEFAULT_ETA_SETTINGS.bufferMinutes),
  };
  // Phone fields start on the chosen market's country code; before a market is chosen, on the visitor's own country.
  const marketChosen = !!(await cookies()).get(TENANT_COOKIE)?.value;
  const countryCode = marketChosen ? marketCountry : ipCountry;

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${tajawal.variable} overscroll-none font-sans antialiased bg-neutral-50 text-neutral-900`}
      >
        <ChunkErrorReload />
        <MarketToast />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <LocaleProvider locale={locale}>
        <MoneyProvider currency={currency} countryCode={marketCountry}>
        <DefaultCountryProvider countryCode={countryCode}>
        <CustomerStateProvider>
        <StoreDirectoryProvider>
        <DeliveryLocationProvider eta={etaSettings}>
        <HeaderGate hideOnMobileFullscreen>
          {marketSuggestion && <MarketSuggestionBanner suggested={marketSuggestion.suggested} />}
          <Header />
        </HeaderGate>
        <DeliveryBanner />
        <main className="min-h-screen">
          <BackBar />
          {children}
        </main>
        <HeaderGate hideOnMobileFullscreen>
          <div className="pb-36 md:pb-0">
            <Footer />
          </div>
        </HeaderGate>
        <MobileNavGate>
          <MobileBottomNav />
        </MobileNavGate>
        <FloatingCartBar />
        <PushOptIn />
        </DeliveryLocationProvider>
        </StoreDirectoryProvider>
        </CustomerStateProvider>
        </DefaultCountryProvider>
        </MoneyProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
