"use client";

import { ArrowRight, MapPin, Minus, Plus } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Product, ProductStatus } from "@/types/product";
import { ProductImage } from "./ProductImage";

const statusLabels: Record<ProductStatus, string> = {
  available: "Còn hàng",
  low_stock: "Sắp hết",
  out_of_stock: "Hết hàng",
  hidden: "Đang ẩn",
};

function statusFor(quantity: number): ProductStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= 4) return "low_stock";
  return "available";
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const tone = status === "low_stock" ? "low" : status === "out_of_stock" ? "out" : status === "hidden" ? "hidden" : "";
  return <span className={`status-badge ${tone}`}><i />{statusLabels[status]}</span>;
}

export function ProductCard({
  product,
  onSelect,
  onAdjustQuantity,
}: {
  product: Product;
  onSelect: () => void;
  onAdjustQuantity: (delta: number) => void;
}) {
  function stopPropagation(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return <div className="product-row" role="button" tabIndex={0} onClick={onSelect} onKeyDown={handleKeyDown}>
    <ProductImage product={product} className="product-thumb" />
    <div><div className="product-title">{product.name}</div><span className="product-code">ID: <b>{product.id}</b></span></div>
    <div className="cell-value">{product.brand}</div>
    <div className="cell-value">{product.color}</div>
    <div>
      <div className="stock-stack">
        <ProductStatusBadge status={statusFor(product.quantity)} />
        <div className="quantity-control" onClick={stopPropagation}>
          <button className="mini-icon-btn" aria-label={`Giảm tồn ${product.name}`} disabled={!product.quantity} onClick={() => onAdjustQuantity(-1)}><Minus /></button>
          <strong>{product.quantity}</strong>
          <button className="mini-icon-btn" aria-label={`Tăng tồn ${product.name}`} onClick={() => onAdjustQuantity(1)}><Plus /></button>
        </div>
      </div>
      <div className="cell-value location-value"><span className="cell-label">Vị trí</span><MapPin size={10} />{product.location || "Chưa xếp kệ"}</div>
    </div>
    <button className="row-action" aria-label={`Xem ${product.name}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}><ArrowRight /></button>
  </div>;
}