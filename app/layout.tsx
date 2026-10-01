import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AuthGuard } from "@/components/auth-guard";
import { ExpenseProvider } from "@/components/expense-provider";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#10241c",
};

export const metadata: Metadata = {
  title: {
    default: "Aura",
    template: "%s · Aura",
  },
  description:
    "A daily personal expense ledger with a receipt scanner you review before anything is saved.",
  applicationName: "Aura",
  appleWebApp: {
    capable: true,
    title: "Aura",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=["cobalt","emerald","burgundy","rose","plum"];var t=localStorage.getItem("aura-theme");if(a.indexOf(t)<0)t="emerald";document.documentElement.dataset.theme=t;document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <ExpenseProvider>
              <AuthGuard>{children}</AuthGuard>
              <PwaRegister />
              <Toaster />
            </ExpenseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
