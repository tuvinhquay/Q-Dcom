import { qdcomDB } from "@/lib/db/qdcomDB";
import type { Product, ProductStatus } from "@/types/product";
import { getActiveTenantId } from "@/lib/tenancy/activeTenant";

function statusFor(quantity: number): ProductStatus { return quantity <= 0 ? "out_of_stock" : quantity <= 4 ? "low_stock" : "available"; }

export async function listProducts(tenantId: string = getActiveTenantId()): Promise<Product[]> {
  if (!tenantId.trim()) throw new Error("Thiếu mã xưởng hiện tại.");
  return qdcomDB.products.where("tenantId").equals(tenantId).sortBy("updated_at").then((products) => products.reverse());
}

export async function saveProduct(product: Product, originalId?: string, tenantId: string = getActiveTenantId()): Promise<Product> {
  if (!tenantId.trim()) throw new Error("Thiếu mã xưởng hiện tại.");
  const current = originalId ? await qdcomDB.products.get(originalId) : undefined;
  if (current && current.tenantId !== tenantId) throw new Error("Không thể sửa mẫu hàng thuộc xưởng khác.");
  const saved = { ...product, id: originalId ?? product.id, tenantId };
  await qdcomDB.products.put(saved);
  return saved;
}

export async function adjustProductQuantity(id: string, delta: number, tenantId: string = getActiveTenantId()): Promise<Product> {
  if (!tenantId.trim()) throw new Error("Thiếu mã xưởng hiện tại.");
  return qdcomDB.transaction("rw", qdcomDB.products, async () => {
    const current = await qdcomDB.products.get(id);
    if (!current || current.tenantId !== tenantId) throw new Error("Không tìm thấy mẫu hàng trong xưởng hiện tại.");
    const quantity = Math.max(0, current.quantity + delta);
    const updated = { ...current, quantity, status: current.status === "hidden" ? "hidden" as const : statusFor(quantity), updated_at: new Date().toISOString() };
    await qdcomDB.products.put(updated);
    return updated;
  });
}

export async function deleteProduct(id: string, tenantId: string = getActiveTenantId()): Promise<void> {
  const current = await qdcomDB.products.get(id);
  if (!current) return;
  if (current.tenantId !== tenantId) throw new Error("Không thể xóa mẫu hàng thuộc xưởng khác.");
  await qdcomDB.products.delete(id);
}