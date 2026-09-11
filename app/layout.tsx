import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { MobileNavProvider } from "@/components/MobileNav";
import { getMetaAccounts } from "@/lib/env";

/**
 * PlayOut Kids · Media Suite · Font Sora (Fibrand brand)
 * 2026-07-27 · Reemplaza Space Grotesk para consistencia con ERP/CRM.
 * Pesos 400-900 · display swap para no bloquear first paint.
 */
const sora = Sora({
  subsets: ["latin"],
  // Sora max weight = 800 en Google Fonts (no tiene 900).
  // El CSS h1 { font-weight: 900 } cae naturalmente a 800.
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Media Suite · PlayOut Kids",
  description: "Copiloto de campañas Meta Ads + Google Ads · PlayOut Kids ERP",
  // Favicon homologado con ERP + Suite Selector · sonrisa amarilla del logo original sobre royal deep
  // Next.js 13+ App Router también detecta auto app/favicon.ico como fallback
  icons: {
    icon: "/media/favicon.ico",
    shortcut: "/media/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const metaAccounts = getMetaAccounts();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sora.variable} bg-page text-ink antialiased`}>
        <MobileNavProvider>
          <div className="flex min-h-screen">
            <Suspense>
              <Sidebar />
            </Suspense>
            <div className="flex min-w-0 flex-1 flex-col">
              <Suspense>
                <Header metaAccounts={metaAccounts} />
              </Suspense>
              <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
            </div>
          </div>
        </MobileNavProvider>
      </body>
    </html>
  );
}
