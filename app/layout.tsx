import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candidate Finder",
  description: "AI candidate search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
