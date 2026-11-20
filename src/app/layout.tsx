import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewWine Traffic Monitor",
  description: "Daily traffic-drop alerts for NewWine client sites",
};

export const viewport: Viewport = { themeColor: "#0D1B2A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
