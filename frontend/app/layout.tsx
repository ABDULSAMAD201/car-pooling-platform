import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carpool Ride Request",
  description:
    "Request a carpool ride — frontend for the carpool backend resilience engineering project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}