import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/I18nProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Learning Courses",
    template: "%s | Learning Courses",
  },
  description:
    "AI-powered learning platform that generates structured courses with lessons organized as a prerequisite graph. Supports math, physics, CS, and any STEM subject.",
  openGraph: {
    title: "Learning Courses",
    description:
      "AI-powered learning platform with structured courses, quizzes, and adaptive recommendations.",
    type: "website",
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
            <Toaster />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
