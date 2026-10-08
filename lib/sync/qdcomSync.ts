import type { BotVocabulary } from "@/lib/bot/vocabulary";
import type { QDcomMember } from "@/lib/db/qdcomDB";
import type { Product, ProductStatus } from "@/types/product";

export interface QDcomSharePayload {
  format: "qdcom-share";
  version: 1;
  peer: { peerId: string; displayName: string; email: string; avatar: string };
  products: Product[];
}

export interface QDcomBackup {
  format: "qdcom-backup";
  version: 1;
  exportedAt: string;
  products: Product[];
  botVocabulary: BotVocabulary;
  members: QDcomMember[];
}

const statuses = new Set<ProductStatus>(["available", "low_stock", "out_of_stock", "hidden"]);
const asRecord = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, max = 2000): value is string => typeof value === "string" && value.length <= max;
const stringList = (value: unknown, maxItems = 100): value is string[] => Array.isArray(value) && value.length <= maxItems && value.every((item) => text(item, 1000));
const safeImage = (url: string) => url.length <= 1_000_000 && (url.startsWith("https://") || url.startsWith("/") || /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(url));
const imageList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 5 && value.every((item) => typeof item === "string" && safeImage(item));

function isProduct(value: unknown): value is Product {
  const item = asRecord(value);
  return Boolean(item && text(item.id, 160) && item.id && text(item.name, 300) && text(item.brand, 200) &&
    text(item.color, 200) && stringList(item.size, 100) && Number.isSafeInteger(item.quantity) && Number(item.quantity) >= 0 &&
    imageList(item.image_urls) &&
    text(item.image_notes, 2000) && text(item.description, 4000) && text(item.category, 200) && statuses.has(item.status as ProductStatus) &&
    text(item.location, 300) && text(item.created_by, 200) && text(item.created_at, 100) && text(item.updated_at, 100) &&
    stringList(item.search_keywords, 100));
}

function isVocabulary(value: unknown): value is BotVocabulary {
  const data = asRecord(value);
  const intents = asRecord(data?.intents);
  const responses = asRecord(data?.responses);
  return Boolean(intents && responses && stringList(intents.CHECK_QUANTITY, 500) && stringList(intents.CHECK_LOCATION, 500) &&
    stringList(intents.GREETING, 500) && stringList(responses.GREETING, 100) && stringList(responses.NOT_FOUND, 100));
}

function safeImageUrls(urls: string[]) {
  return urls.filter((url) => !url.startsWith("data:") && (url.startsWith("https://") || url.startsWith("/"))).slice(0, 5);
}

export function createSharePayload(peer: QDcomSharePayload["peer"], products: Product[]): string {
  const payload: QDcomSharePayload = {
    format: "qdcom-share",
    version: 1,
    peer,
    products: products.map((product) => ({ ...product, image_urls: safeImageUrls(product.image_urls) })),
  };
  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength > 2700) {
    throw new Error("Mã QR vượt giới hạn dung lượng. Hãy chia sẻ ít mẫu hơn hoặc bỏ ảnh và mô tả dài.");
  }
  return serialized;
}

export function parseSharePayload(raw: string): QDcomSharePayload {
  if (new TextEncoder().encode(raw).byteLength > 3000) throw new Error("Dữ liệu QR vượt giới hạn cho phép.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Mã QR không chứa JSON hợp lệ của Q-Dcom."); }
  const data = asRecord(value);
  const peer = asRecord(data?.peer);
  if (data?.format !== "qdcom-share" || data.version !== 1 || !peer || !text(peer.peerId, 160) || !peer.peerId ||
    !text(peer.displayName, 200) || !text(peer.email, 320) || !text(peer.avatar, 2000) ||
    !Array.isArray(data.products) || data.products.length > 20 || !data.products.every(isProduct) ||
    data.products.some((product) => product.image_urls.some((url) => url.startsWith("data:")))) {
    throw new Error("Mã QR không đúng cấu trúc chia sẻ Q-Dcom hoặc chứa dữ liệu không an toàn.");
  }
  return { format: "qdcom-share", version: 1, peer: { peerId: peer.peerId, displayName: peer.displayName, email: peer.email, avatar: peer.avatar }, products: data.products };
}

export function serializeBackup(products: Product[], botVocabulary: BotVocabulary, members: QDcomMember[]): string {
  return JSON.stringify({ format: "qdcom-backup", version: 1, exportedAt: new Date().toISOString(), products, botVocabulary, members } satisfies QDcomBackup, null, 2);
}

export function parseBackup(raw: string): QDcomBackup {
  if (new TextEncoder().encode(raw).byteLength > 25_000_000) throw new Error("File backup vượt giới hạn 25 MB.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("File không phải JSON hợp lệ."); }
  const data = asRecord(value);
  const members = data?.members;
  const validMembers = Array.isArray(members) && members.length <= 5000 && members.every((entry) => {
    const member = asRecord(entry);
    return Boolean(member && text(member.peerId, 160) && member.peerId && text(member.displayName, 200) &&
      text(member.email, 320) && text(member.avatar, 2000) && (!member.avatar || member.avatar.startsWith("https://")) && text(member.addedAt, 100));
  });
  if (data?.format !== "qdcom-backup" || data.version !== 1 || !text(data.exportedAt, 100) ||
    !Array.isArray(data.products) || data.products.length > 10000 || !data.products.every(isProduct) ||
    !isVocabulary(data.botVocabulary) || !validMembers) {
    throw new Error("Cấu trúc backup không hợp lệ hoặc có trường dữ liệu sai kiểu.");
  }
  return data as unknown as QDcomBackup;
}
