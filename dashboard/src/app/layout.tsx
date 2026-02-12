import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/layout/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
  title: "Duckling",
  description:
    "Autonomous coding agent platform — submit tasks, monitor execution, review results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="noise-bg flex h-dvh overflow-hidden">
            <Sidebar />
            <main className="relative flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-[var(--duckling-amber-soft)]">
              {/* Amber horizontal rule top bar */}
              <div className="flex items-center justify-end px-6 py-3 relative">
                <ThemeToggle />
                {/* Amber gradient rule replacing plain border */}
                <div className="absolute bottom-0 left-0 right-0 h-px">
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--duckling-amber-muted)] to-transparent" />
                </div>
              </div>
              <div className="relative z-[1] p-6">{children}</div>
            </main>
          </div>
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
