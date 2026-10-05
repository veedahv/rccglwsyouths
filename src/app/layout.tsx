import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Figtree, Bricolage_Grotesque } from "next/font/google";
import { AuthProvider } from "@/lib/useAuth";
import AppChrome from "@/components/AppChrome";
import "./globals.css";

// "latin-ext" is included so the Naira sign (₦, U+20A6) comes from the
// web font rather than a fallback system font.
const body = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LWS RCCG Youths Platform",
  description: "Exco platform for the LWS RCCG Youth Department",
};

export const viewport: Viewport = {
  themeColor: "#180C62",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
