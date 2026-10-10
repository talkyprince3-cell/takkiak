import type { Metadata, Viewport } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import "./globals.css";

// Inter is the interface face (taken from betafrica.site's build — a variable
// font, so every weight the board uses ships in one file); Bebas Neue is the
// display face for the wordmark.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stakeza — Live Sports Betting & Casino",
  description:
    "Bet live on football and more, and cash out fast with mobile money on Stakeza. Live odds, instant betslips, booking codes and daily boosted odds.",
  manifest: "/manifest.json",
  icons: { icon: "/logo-mark.svg", apple: "/logo-mark.svg" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint, so a light-theme player
            never sees a dark flash. Dark is the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
