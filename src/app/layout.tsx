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

const sign = Gaegu({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-sign",
  display: "swap",
});

export const metadata: Metadata = {
  title: "포트폴리오 정원",
  description: "한국 주식 포트폴리오를 정원으로 봅니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} ${sign.variable} h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&display=swap"
        />
      </head>
      <body className="min-h-full antialiased">
        <GardenProvider>{children}</GardenProvider>
      </body>
    </html>
  );
}
