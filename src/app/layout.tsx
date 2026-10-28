import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Topicore",
    template: "%s · Topicore",
  },
  description: "Generate focused SQL and Python practice questions and start learning quickly.",
  openGraph: {
    type: "website",
    siteName: "Topicore",
    title: "Topicore",
    description: "Generate focused SQL and Python practice questions and start learning quickly.",
  },
  robots: { index: true, follow: true },
  twitter: {
    card: "summary",
    title: "Topicore",
    description: "Generate focused SQL and Python practice questions and start learning quickly.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
