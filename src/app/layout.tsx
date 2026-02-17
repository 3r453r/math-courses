import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/I18nProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { VersionCheck } from "@/components/VersionCheck";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Learning Courses",
    template: "%s | Learning Courses",
  },
  description:
    "AI-powered learning platform that generates structured courses with lessons organized as a prerequisite graph. Supports math, physics, CS, and any STEM subject.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Learning Courses",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "theme-color": "#6366f1",
  },
  openGraph: {
    title: "Learning Courses",
    description:
      "AI-powered learning platform with structured courses, quizzes, and adaptive recommendations.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Learning Courses — AI-powered structured learning",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning Courses",
    description:
      "AI-powered learning platform with structured courses, quizzes, and adaptive recommendations.",
    images: ["/og-image.png"],
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
        <ThemeProvider>
          <SessionProvider>
            <I18nProvider>
              {children}
            </I18nProvider>
            <VersionCheck />
            <Toaster />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
