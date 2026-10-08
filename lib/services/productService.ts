import { qdcomDB } from "@/lib/db/qdcomDB";
import type { Product, ProductStatus } from "@/types/product";

function statusFor(quantity: number): ProductStatus { return quantity <= 0 ? "out_of_stock" : quantity <= 4 ? "low_stock" : "available"; }

export async function listProducts(): Promise<Product[]> {
  return qdcomDB.products.orderBy("updated_at").reverse().toArray();
}

export async function saveProduct(product: Product, originalId?: string): Promise<Product> {
  const saved = originalId ? { ...product, id: originalId } : product;
  await qdcomDB.products.put(saved);
  return saved;
}

export async function adjustProductQuantity(id: string, delta: number): Promise<Product> {
  return qdcomDB.transaction("rw", qdcomDB.products, async () => {
    const current = await qdcomDB.products.get(id);
    if (!current) throw new Error("Không tìm thấy mẫu hàng cần cập nhật.");
    const quantity = Math.max(0, current.quantity + delta);
    const updated = { ...current, quantity, status: current.status === "hidden" ? "hidden" as const : statusFor(quantity), updated_at: new Date().toISOString() };
    await qdcomDB.products.put(updated);
    return updated;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await qdcomDB.products.delete(id);
}