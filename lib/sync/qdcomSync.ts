import type { BotVocabulary } from "@/lib/bot/vocabulary";
import type { IndustryCustomField, LocalProductionRecord, ProductionRecord, QDcomMember } from "@/lib/db/qdcomDB";
import type { Product, ProductStatus } from "@/types/product";

export interface QDcomSharePayload {
  format: "qdcom-share";
  version: 2;
  peer: { peerId: string; displayName: string; email: string };
  products: QDcomShareProduct[];
}

export interface QDcomShareProduct {
  id: string;
  name: string;
  quantity: number;
  price: number | null;
}

export interface QDcomBackup {
  format: "qdcom-backup";
  version: 3;
  exportedAt: string;
  products: Product[];
  botVocabulary: BotVocabulary;
  members: QDcomMember[];
  industryCustomFields: IndustryCustomField[];
  productionRecords: ProductionRecord[];
  localProduction: LocalProductionRecord[];
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
    (!("price" in item) || (typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0)) &&
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

function isIndustryCustomField(value: unknown): value is IndustryCustomField {
  const field = asRecord(value);
  return Boolean(field && text(field.id, 160) && field.id && text(field.industryType, 200) && field.industryType &&
    text(field.label, 200) && field.label.trim() &&
    (field.type === "text" || field.type === "number" || field.type === "date") &&
    text(field.unit, 80) && text(field.createdAt, 100));
}

function isProductionRecord(value: unknown): value is ProductionRecord {
  const record = asRecord(value);
  const customValues = asRecord(record?.customValues);
  return Boolean(record && text(record.id, 160) && record.id &&
    text(record.industryType, 200) && record.industryType &&
    text(record.date, 20) && text(record.line, 200) && text(record.shift, 100) &&
    Number.isSafeInteger(record.quantity) && Number(record.quantity) >= 0 &&
    text(record.note, 2000) && text(record.createdAt, 100) &&
    Array.isArray(record.customFields) && record.customFields.length <= 500 &&
    record.customFields.every((entry) => {
      const field = asRecord(entry);
      return Boolean(field && text(field.id, 160) && text(field.label, 200) && text(field.unit, 80));
    }) &&
    customValues && Object.keys(customValues).length <= 500 &&
    Object.values(customValues).every((entry) => text(entry, 2000)));
}

function isLocalProductionRecord(value: unknown): value is LocalProductionRecord {
  const record = asRecord(value);
  const data = asRecord(record?.data);
  if (!record || !data || !text(record.id, 500) || !record.id ||
    !text(record.ownerUid, 160) || !record.ownerUid ||
    !text(record.groupId, 200) || !record.groupId ||
    !["group", "order", "stage", "field", "entry"].includes(String(record.kind)) ||
    !text(record.updatedAt, 100)) return false;
  const sameTenant = data.groupId === record.groupId;
  if (record.kind === "group") {
    return record.id === `${record.ownerUid}:${record.groupId}:group:${record.groupId}` &&
      data.id === record.groupId && data.ownerId === record.ownerUid &&
      text(data.name, 100) && Array.isArray(data.memberIds) && data.memberIds.every((item) => text(item, 160)) &&
      Array.isArray(data.managerIds) && data.managerIds.every((item) => text(item, 160)) &&
      typeof data.approvalRequired === "boolean" && data.localOnly === true;
  }
  if (!sameTenant || !text(data.id, 200) || !data.id) return false;
  if (record.id !== `${record.ownerUid}:${record.groupId}:${String(record.kind)}:${data.id}`) return false;
  if (record.kind === "order") {
    return text(data.code, 100) && text(data.po, 100) && text(data.color, 80) &&
      text(data.productName, 160) && typeof data.active === "boolean";
  }
  if (record.kind === "stage") {
    return text(data.orderId, 200) && text(data.name, 100) && text(data.line, 100) &&
      Number.isSafeInteger(data.unitPriceVnd) && Number(data.unitPriceVnd) >= 0 &&
      typeof data.active === "boolean";
  }
  if (record.kind === "field") {
    return text(data.label, 100) && ["text", "number", "date"].includes(String(data.type)) &&
      text(data.unit, 40) && typeof data.required === "boolean";
  }
  const customValues = asRecord(data.customValues);
  return record.kind === "entry" && data.workerId === record.ownerUid &&
    text(data.workerName, 120) && text(data.orderId, 200) && text(data.orderCode, 100) &&
    text(data.po, 100) && text(data.color, 80) && text(data.stageId, 200) &&
    text(data.stageName, 100) && text(data.line, 100) && text(data.date, 20) &&
    Number.isSafeInteger(data.quantity) && Number(data.quantity) > 0 &&
    Number.isSafeInteger(data.unitPriceVnd) && Number(data.unitPriceVnd) >= 0 &&
    Number.isSafeInteger(data.amountVnd) && Number(data.amountVnd) === Number(data.quantity) * Number(data.unitPriceVnd) &&
    ["pending", "approved", "revision_requested"].includes(String(data.status)) &&
    text(data.reviewNote, 500) && text(data.reviewedBy, 160) &&
    customValues !== null && Object.keys(customValues).length <= 50 &&
    Object.values(customValues).every((item) => text(item, 2000));
}

function safeImageUrls(urls: string[]) {
  return urls.filter((url) => !url.startsWith("data:") && (url.startsWith("https://") || url.startsWith("/"))).slice(0, 5);
}

function isShareProduct(value: unknown): value is QDcomShareProduct {
  const item = asRecord(value);
  return Boolean(item && Object.keys(item).length === 4 &&
    Object.keys(item).every((key) => ["id", "name", "quantity", "price"].includes(key)) &&
    text(item.id, 160) && item.id && text(item.name, 300) && item.name.trim() &&
    Number.isSafeInteger(item.quantity) && Number(item.quantity) >= 0 &&
    (item.price === null || (typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0)));
}

function isLegacyShareProducts(value: unknown): value is Product[] {
  return Array.isArray(value) && value.every(isProduct) &&
    !value.some((product: Product) => product.image_urls.some((url) => url.startsWith("data:")));
}

function isShareProducts(value: unknown): value is QDcomShareProduct[] {
  return Array.isArray(value) && value.every(isShareProduct);
}

export function createSharePayload(peer: QDcomSharePayload["peer"], products: Product[]): string {
  const payload: QDcomSharePayload = {
    format: "qdcom-share",
    version: 2,
    peer: { peerId: peer.peerId, displayName: peer.displayName, email: peer.email },
    products: products.map(({ id, name, quantity, price }) => ({ id, name, quantity, price: price ?? null })),
  };
  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength > 2700) {
    throw new Error("Mã QR vượt giới hạn dung lượng. Hãy chia sẻ ít mẫu hàng hơn.");
  }
  return serialized;
}

export function parseSharePayload(raw: string): QDcomSharePayload {
  if (new TextEncoder().encode(raw).byteLength > 3000) throw new Error("Dữ liệu QR vượt giới hạn cho phép.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Mã QR không chứa JSON hợp lệ của Q-Dcom."); }
  const data = asRecord(value);
  const peer = asRecord(data?.peer);
  if (data?.format !== "qdcom-share" || !peer || !text(peer.peerId, 160) || !peer.peerId ||
    !text(peer.displayName, 200) || !text(peer.email, 320) ||
    !Array.isArray(data.products) || data.products.length > 20) {
    throw new Error("Mã QR không đúng cấu trúc chia sẻ Q-Dcom hoặc chứa dữ liệu không an toàn.");
  }
  if (data.version === 1) {
    if (!text(peer.avatar, 2000) || !isLegacyShareProducts(data.products)) {
      throw new Error("Mã QR không đúng cấu trúc chia sẻ Q-Dcom hoặc chứa dữ liệu không an toàn.");
    }
    return {
      format: "qdcom-share",
      version: 2,
      peer: { peerId: peer.peerId, displayName: peer.displayName, email: peer.email },
      products: data.products.map(({ id, name, quantity, price }) => ({ id, name, quantity, price: price ?? null })),
    };
  }
  if (data.version !== 2 || !isShareProducts(data.products)) {
    throw new Error("Mã QR không đúng cấu trúc chia sẻ Q-Dcom hoặc chứa dữ liệu không an toàn.");
  }
  return {
    format: "qdcom-share",
    version: 2,
    peer: { peerId: peer.peerId, displayName: peer.displayName, email: peer.email },
    products: data.products,
  };
}

export function serializeBackup(
  products: Product[],
  botVocabulary: BotVocabulary,
  members: QDcomMember[],
  options: {
    omitBase64Images?: boolean;
    industryCustomFields?: IndustryCustomField[];
    productionRecords?: ProductionRecord[];
    localProduction?: LocalProductionRecord[];
  } = {},
): string {
  const productsToSerialize = options.omitBase64Images
    ? products.map((product) => ({ ...product, image_urls: safeImageUrls(product.image_urls) }))
    : products;
  return JSON.stringify({
    format: "qdcom-backup",
    version: 3,
    exportedAt: new Date().toISOString(),
    products: productsToSerialize,
    botVocabulary,
    members,
    industryCustomFields: options.industryCustomFields ?? [],
    productionRecords: options.productionRecords ?? [],
    localProduction: options.localProduction ?? [],
  } satisfies QDcomBackup, null, 2);
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
  const isCurrentCustomData = data?.version === 1 || (
    (data?.version === 2 || data?.version === 3) &&
    Array.isArray(data.industryCustomFields) && data.industryCustomFields.length <= 5000 &&
    data.industryCustomFields.every(isIndustryCustomField) &&
    Array.isArray(data.productionRecords) && data.productionRecords.length <= 100_000 &&
    data.productionRecords.every(isProductionRecord) &&
    (data.version === 2 || (
      Array.isArray(data.localProduction) && data.localProduction.length <= 100_000 &&
      data.localProduction.every(isLocalProductionRecord)
    ))
  );
  if (data?.format !== "qdcom-backup" || !isCurrentCustomData || !text(data.exportedAt, 100) ||
    !Array.isArray(data.products) || data.products.length > 10000 || !data.products.every(isProduct) ||
    !isVocabulary(data.botVocabulary) || !validMembers) {
    throw new Error("Cấu trúc backup không hợp lệ hoặc có trường dữ liệu sai kiểu.");
  }
  return {
    ...data,
    version: 3,
    industryCustomFields: data.version === 1 ? [] : data.industryCustomFields as IndustryCustomField[],
    productionRecords: data.version === 1 ? [] : data.productionRecords as ProductionRecord[],
    localProduction: data.version === 3 ? data.localProduction as LocalProductionRecord[] : [],
  } as unknown as QDcomBackup;
}
