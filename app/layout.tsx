import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { MobileNavProvider } from "@/components/MobileNav";
import { getMetaAccounts } from "@/lib/env";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Campaign Copilot v2",
  description: "Dashboard de Meta Ads con SQLite local",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const metaAccounts = getMetaAccounts();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} bg-page text-ink antialiased`}>
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
