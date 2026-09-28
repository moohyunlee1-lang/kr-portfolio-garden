import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, Gaegu } from "next/font/google";
import { GardenProvider } from "@/components/garden-context";
import "./globals.css";

const sans = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm",
  display: "swap",
});

const display = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-sign",
  display: "swap",
});

export const metadata: Metadata = {
  title: "그루밭",
  description: "주식을 나무로 보는 밭",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "그루밭",
    description: "주식을 나무로 보는 밭",
    images: ["/groubat.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} ${display.variable} h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&display=swap"
        />
      </head>
      <body className="min-h-full antialiased">
        <GardenProvider>{children}</GardenProvider>
      </body>
    </html>
  );
}
