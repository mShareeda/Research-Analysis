import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Analysis",
  description: "Analyze published stories, documents, and pasted text.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
