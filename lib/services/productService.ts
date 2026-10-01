import { initialProducts } from "@/data/mockProducts";
import { appConfig, getPocketBaseBaseUrl } from "@/config/app.config";
import type { Product, ProductStatus } from "@/types/product";

const PRODUCTS_KEY = "qdcom.products.v1";
export const USE_LOCAL_SERVER = appConfig.features.useLocalServer;
export interface ProductServiceConfig { useLocalServer: boolean; serverUrl: string }

function readLocal(): Product[] {
  if (typeof window === "undefined") return initialProducts;
  try {
    const saved = window.localStorage.getItem(PRODUCTS_KEY);
    if (!saved) { window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(initialProducts)); return initialProducts; }
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed as Product[] : initialProducts;
  } catch { return initialProducts; }
}

function writeLocal(products: Product[]) { window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); }
function endpoint(config: ProductServiceConfig) {
  const { collection } = appConfig.integrations.pocketbase;
  return `${getPocketBaseBaseUrl(config.serverUrl)}/api/collections/${encodeURIComponent(collection)}/records`;
}

async function request(config: ProductServiceConfig, path = "", init?: RequestInit) {
  const response = await fetch(`${endpoint(config)}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  if (!response.ok) throw new Error((await response.text().catch(() => "")) || `Máy chủ trả về lỗi ${response.status}.`);
  return response.status === 204 ? null : response.json();
}

function statusFor(quantity: number): ProductStatus { return quantity <= 0 ? "out_of_stock" : quantity <= 4 ? "low_stock" : "available"; }

function fromRecord(record: Record<string, unknown>): Product {
  const quantity = Number(record.quantity ?? 0);
  const sizes = Array.isArray(record.size) ? record.size.map(String) : typeof record.size === "string" ? record.size.split(",").map((value) => value.trim()).filter(Boolean) : [];
  const images = Array.isArray(record.image_urls) ? record.image_urls.filter((value): value is string => typeof value === "string") : typeof record.image_urls === "string" ? record.image_urls.split("\n").filter(Boolean) : [];
  return {
    id: String(record.product_id ?? record.id ?? ""), remote_record_id: String(record.id ?? ""),
    name: String(record.name ?? ""), brand: String(record.brand ?? ""), color: String(record.color ?? ""), size: sizes,
    quantity, image_urls: images, image_notes: String(record.image_notes ?? ""), description: String(record.description ?? ""),
    category: String(record.category ?? "Khác"), status: (record.status as ProductStatus | undefined) ?? statusFor(quantity),
    location: String(record.location ?? "Chưa xếp kệ"), created_by: String(record.created_by ?? ""),
    created_at: String(record.created_at ?? record.created ?? new Date().toISOString()), updated_at: String(record.updated_at ?? record.updated ?? new Date().toISOString()),
    search_keywords: Array.isArray(record.search_keywords) ? record.search_keywords.map(String) : [],
  };
}

function toRecord(product: Product) {
  const { id, remote_record_id, ...fields } = product;
  void remote_record_id;
  return { ...fields, product_id: id };
}

export async function listProducts(config: ProductServiceConfig): Promise<Product[]> {
  if (!config.useLocalServer) return readLocal();
  const result = await request(config, `?perPage=${appConfig.integrations.pocketbase.pageSize}&sort=-updated`) as { items?: unknown[] } | unknown[];
  const records = Array.isArray(result) ? result : result.items ?? [];
  return records.map((record) => fromRecord(record as Record<string, unknown>));
}

export async function saveProduct(product: Product, config: ProductServiceConfig, originalId?: string): Promise<Product> {
  if (!config.useLocalServer) {
    const products = readLocal(); const index = originalId ? products.findIndex((item) => item.id === originalId) : -1;
    if (index < 0) products.unshift(product); else products[index] = product;
    writeLocal(products); return product;
  }
  const path = originalId ? `/${encodeURIComponent(product.remote_record_id ?? originalId)}` : "";
  const record = await request(config, path, { method: originalId ? "PATCH" : "POST", body: JSON.stringify(toRecord(product)) });
  return fromRecord(record as Record<string, unknown>);
}

export async function adjustProductQuantity(id: string, delta: number, config: ProductServiceConfig): Promise<Product> {
  const products = await listProducts(config); const current = products.find((item) => item.id === id);
  if (!current) throw new Error("Không tìm thấy mẫu hàng cần cập nhật.");
  const quantity = Math.max(0, current.quantity + delta);
  const updated = { ...current, quantity, status: current.status === "hidden" ? "hidden" as const : statusFor(quantity), updated_at: new Date().toISOString() };
  if (!config.useLocalServer) { writeLocal(products.map((item) => item.id === id ? updated : item)); return updated; }
  return saveProduct(updated, config, id);
}

export async function deleteProduct(id: string, config: ProductServiceConfig): Promise<void> {
  if (!config.useLocalServer) { writeLocal(readLocal().filter((item) => item.id !== id)); return; }
  const product = (await listProducts(config)).find((item) => item.id === id);
  if (!product) throw new Error("Không tìm thấy mẫu hàng cần xóa.");
  await request(config, `/${encodeURIComponent(product.remote_record_id ?? id)}`, { method: "DELETE" });
}