import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

/* Paperboat §3: display = Space Grotesk, body = Geist, label/mono = JetBrains. */
const fontHeading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Paperboat — Edge Console",
    template: "%s · Paperboat",
  },
  description:
    "Deployments, edge traffic, and incident telemetry for your Paperboat projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        fontSans.variable,
        fontHeading.variable,
        fontMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
