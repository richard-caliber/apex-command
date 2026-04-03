import type { Metadata } from "next";
import "./globals.css";
import { MobileNav } from "./mobile-nav";

export const metadata: Metadata = {
  title: "APEX COMMAND CENTRE",
  description: "War Room Dashboard — Mission Control",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased pb-16 sm:pb-0">
        {children}
        <MobileNav />
      </body>
    </html>
  );
}
