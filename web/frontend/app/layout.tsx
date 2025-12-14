import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieBanner } from "@/components/CookieBanner";
import { DesktopNav } from "@/components/DesktopNav";
import { MobileNav } from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "Deep — Deep Thinking Trainer",
  description: "Daily reflections and feedback to level up your reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <DesktopNav />
            <main className="flex-1 pb-20 lg:pb-0">{children}</main>
            <SiteFooter />
          </div>
          <MobileNav />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
