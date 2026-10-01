"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/types/product";

export function ProductImage({ product, className }: { product: Product; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = product.image_urls[0];

  if (!src || failed) {
    return <div className={`${className} image-fallback`} aria-label={`Ảnh ${product.name}`}><Package size={18} /></div>;
  }

  return <Image className={className} src={src} alt={product.name} width={900} height={900} unoptimized onError={() => setFailed(true)} />;
}