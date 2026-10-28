import type { ReactNode } from "react";

/** Bọc nội dung trang hiện hành và chạy chuyển cảnh ngang khi pageKey thay đổi. */
export function SlideContainer({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  return <div key={pageKey} className="slide-container">{children}</div>;
}
