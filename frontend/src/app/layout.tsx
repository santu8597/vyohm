import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vyohm | Zero-Loss Audio Pipeline & Speaker Alignment Dashboard",
  description:
    "WhisperLiveKit-compliant zero-loss alignment layer, RAG agent with strict citations, and confirmation safeguards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
