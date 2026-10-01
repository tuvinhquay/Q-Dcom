import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-Dcom | Quản lý kho & mẫu hàng",
  description: "Tra cứu mẫu hàng, cập nhật tồn kho và vị trí lưu trữ nội bộ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
