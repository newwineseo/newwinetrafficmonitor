import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewWine Traffic Monitor",
  description: "Daily traffic-drop alerts for NewWine client sites",
  manifest: "/manifest.webmanifest",
  applicationName: "NW Monitor",
  appleWebApp: { capable: true, title: "NW Monitor", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0D1B2A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
