import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import Polyfills from "@/app/polyfills";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aurex Property Manager - Management made easy",
  description:
    "Aurex Property Manager is a comprehensive property management platform designed to streamline operations, enhance tenant communication, and optimize property performance. Manage your properties with ease and efficiency.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/logo-dark.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-light.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/logo-light.png",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Polyfills />
          <AuthProvider>
            <QueryProvider>
              <SettingsProvider>{children}</SettingsProvider>
            </QueryProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
