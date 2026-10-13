import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-Dcom | Quản lý kho & mẫu hàng",
  description: "Tra cứu mẫu hàng, cập nhật tồn kho và vị trí lưu trữ nội bộ.",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.svg", apple: "/icons/icon-192.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563EB",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
