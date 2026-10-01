"use client";

import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return <label className="search-box">
    <Search aria-hidden="true" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label="Tìm mẫu hàng" />
  </label>;
}