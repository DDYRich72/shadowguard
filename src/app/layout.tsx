import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import { ThemeInitScript } from "@/components/theme-init";
import { SpartanWatermark } from "@/components/spartan-watermark";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const baseUrl =
  process.env.APP_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const siteName = "ShadowGuard";
const defaultTitle = "ShadowGuard — Open-Source AI Governance";
const defaultDescription =
  "Self-host AI discovery, governance assessments, AgentGuard policy evaluation, MCP governance, evidence, and reporting.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: defaultTitle,
    template: "%s — ShadowGuard",
  },
  description: defaultDescription,
  applicationName: siteName,
  authors: [{ name: "ShadowGuard" }],
  creator: "ShadowGuard",
  publisher: "ShadowGuard",
  keywords: [
    "shadow AI",
    "shadow IT",
    "AI governance",
    "AI discovery",
    "AI security",
    "AgentGuard",
    "ShadowGuard",
    "Google Workspace AI audit",
    "Microsoft 365 AI audit",
    "OAuth app discovery",
    "AI data loss prevention",
    "AI policy enforcement",
    "PII detection AI",
    "credential exfiltration",
  ],
  category: "security",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName,
    locale: "en_US",
    url: "/",
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="relative min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <SpartanWatermark />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
