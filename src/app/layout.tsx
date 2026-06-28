import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppFooter } from "@/components/layout/app-footer";
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
  title: "Chronicle — Local-First Collaborative Editor",
  description:
    "Offline-first document editor with deterministic sync, version history, and role-based collaboration.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
