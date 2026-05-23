import type { Metadata } from "next";
import { Bebas_Neue, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display + numerals. Always uppercase in use (see DESIGN_SYSTEM.md).
const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

// Body. The width axis powers the condensed variants used in data-dense panels.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// Tabular mono — every number that aligns in a table.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Academy Fantasy — Fantasy League for F1 Academy",
  description:
    "Pick a team within budget, score points across the season, and compete with friends. A free-to-play fantasy game for the F1 Academy series. Entertainment only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `dark` is permanent — black-first, no light theme (see DESIGN_SYSTEM.md).
  return (
    <html
      lang="en"
      className={`dark ${bebas.variable} ${archivo.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh bg-base font-body text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
