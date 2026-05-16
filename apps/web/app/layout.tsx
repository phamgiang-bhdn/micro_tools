import type { Metadata, Viewport } from "next";
import type React from "react";
import { Suspense } from "react";
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
    default: "dealvault — So sánh & săn deal mỗi ngày",
    template: "%s | dealvault"
  },
  description:
    "So sánh giá hàng đầu Việt Nam: thẻ tín dụng, công nghệ, gia dụng, du lịch, mỹ phẩm. Cập nhật ưu đãi mỗi ngày.",
  applicationName: "dealvault",
  keywords: ["so sánh giá", "săn deal", "giảm giá", "khuyến mãi", "voucher", "mua sắm thông minh"],
  openGraph: {
    type: "website",
    siteName: "dealvault",
    title: "dealvault — So sánh & săn deal mỗi ngày",
    description: "Giá tốt, ưu đãi mới, gọn trong một trang."
  },
  twitter: {
    card: "summary_large_image",
    title: "dealvault",
    description: "So sánh & săn deal mỗi ngày"
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
        <Suspense fallback={<div className="h-16 border-b border-line bg-card/80" />}>
          <Navbar />
        </Suspense>
        <main className="mx-auto min-h-[calc(100vh-200px)] w-full">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
