import type { Metadata, Viewport } from "next";
import type React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Footer } from "../components/footer";
import { Navbar } from "../components/navbar";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "dealvault — So sánh, săn deal affiliate thông minh",
    template: "%s | dealvault"
  },
  description:
    "dealvault tổng hợp ưu đãi affiliate, dùng AI trích dữ liệu sản phẩm và đo conversion theo từng click. So sánh nhanh, mua đúng giá.",
  applicationName: "dealvault",
  keywords: ["affiliate", "so sánh giá", "deal", "săn sale", "voucher", "micro-tool"],
  openGraph: {
    type: "website",
    siteName: "dealvault",
    title: "dealvault — So sánh, săn deal affiliate thông minh",
    description: "AI extract + tracking chuẩn xác để bạn chọn deal tốt nhất."
  },
  twitter: {
    card: "summary_large_image",
    title: "dealvault",
    description: "So sánh, săn deal affiliate thông minh"
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23ee1f12'/><text x='50%25' y='55%25' font-size='18' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold' dominant-baseline='middle'>d.</text></svg>"
      }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: "#fbf8f5",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="vi">
      <body className={`${display.className} min-h-screen bg-canvas text-ink antialiased`}>
        <Navbar />
        <main className="mx-auto min-h-[calc(100vh-180px)] w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
