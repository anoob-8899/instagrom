import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INSTAGROM — Classroom LAN Social Network",
  description: "A local classroom-only social network running on a local Wi-Fi/LAN.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
