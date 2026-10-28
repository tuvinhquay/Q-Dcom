"use client";

import Image from "next/image";
import {
  BarChart3, Boxes, LayoutDashboard, MessageCircle, Package, Rocket, Settings,
  ShieldCheck, TrendingUp, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Điều hướng dùng chung cho sidebar desktop và thanh menu trên mobile. */
export type PageKey =
  | "inventory"
  | "reports"
  | "productivity"
  | "bot"
  | "community"
  | "settings"
  | "about"
  | "privacy";

type MenuItem = { id: PageKey; label: string; icon: LucideIcon };
type MenuGroup = { label: string; items: MenuItem[] };
type SidebarProfile = { displayName: string; avatar: string; memberId?: string; email: string } | null;

/** Bốn nhóm chức năng là nguồn cấu hình duy nhất cho cả desktop và mobile. */
export const menuGroups: MenuGroup[] = [
  {
    label: "Quản lý Kho & Mẫu hàng",
    items: [
      { id: "inventory", label: "Mẫu hàng & Kho", icon: LayoutDashboard },
      { id: "reports", label: "Tổng quan kho", icon: BarChart3 },
    ],
  },
  {
    label: "Sản lượng & Chuyền may",
    items: [{ id: "productivity", label: "Sản lượng chuyền", icon: TrendingUp }],
  },
  {
    label: "Trợ lý @q & Cộng đồng",
    items: [
      { id: "bot", label: "Trợ lý @q", icon: MessageCircle },
      { id: "community", label: "Cộng đồng chat", icon: Users },
    ],
  },
  {
    label: "Cài đặt hệ thống",
    items: [
      { id: "settings", label: "Cài đặt", icon: Settings },
      { id: "about", label: "Giới thiệu Q-Dcom", icon: Rocket },
      { id: "privacy", label: "Chính sách bảo mật", icon: ShieldCheck },
    ],
  },
];

type SidebarMenuProps = {
  page: PageKey;
  itemCount: number;
  profile: SidebarProfile;
  onNavigate: (page: PageKey) => void;
};

/** Sidebar trái hiển thị nhóm tính năng, số mẫu hàng và hồ sơ hiện tại. */
export function SidebarMenu({ page, itemCount, profile, onNavigate }: SidebarMenuProps) {
  return (
    <aside className="sidebar glass">
      <div className="brand">
        <div className="brand-mark"><Boxes /></div>
        <div>
          <div className="brand-word">Q-<span>Dcom</span></div>
          <div className="brand-caption">Quản lý kho & sản lượng</div>
        </div>
      </div>
      <nav className="nav-stack" aria-label="Điều hướng chính">
        {menuGroups.map((group) => (
          <section className="nav-group" key={group.label} aria-label={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(({ id, label, icon: Icon }, index) => {
              const isActive = page === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`nav-link ${isActive ? "active" : ""}`}
                  style={{ animationDelay: `${index * 45}ms` }}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onNavigate(id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {id === "inventory" && <span className="nav-count">{itemCount}</span>}
                </button>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="warehouse-switch">
        <div className="warehouse-icon"><Package /></div>
        <div><small>Kho đang hoạt động</small><strong>Kho trung tâm · HCM</strong></div>
      </div>
      <div className="profile-row">
        <div className="avatar">
          {profile?.avatar
            ? <Image src={profile.avatar} alt="" fill unoptimized sizes="31px" />
            : profile?.displayName.slice(0, 2).toUpperCase() ?? "TN"}
        </div>
        <div className="profile-copy">
          <strong>{profile?.displayName ?? "Trần Ngọc"}</strong>
          <span>{profile?.memberId ? `ID: ${profile.memberId}` : profile?.email || "Quản lý kho"}</span>
        </div>
      </div>
    </aside>
  );
}

/** Thanh điều hướng mobile giữ cùng nhóm trang và trạng thái active như sidebar. */
export function MobileNavMenu({ page, onNavigate }: Pick<SidebarMenuProps, "page" | "onNavigate">) {
  return (
    <nav className="bottom-nav" aria-label="Điều hướng di động">
      {menuGroups.flatMap(({ items }) => items).map(({ id, label, icon: Icon }) => {
        const isActive = page === id;
        return (
          <button
            key={id}
            type="button"
            className={isActive ? "active" : ""}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
