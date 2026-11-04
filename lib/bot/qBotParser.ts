import type { Product } from "@/types/product";
import { classifyQBotPermission } from "@/lib/tenancy/authorization";
import type { TenantRole } from "@/types/tenant";
import { DEFAULT_TENANT_ID } from "@/lib/db/qdcomDB";
import { copyDefaultVocabulary, type BotIntent, type BotVocabulary } from "./vocabulary";

export interface QBotResult {
  intent: BotIntent | "SHOW_CARD";
  message: string;
  products: Product[];
  role: TenantRole;
  tenantId: string;
}

export interface QBotContext {
  /** Must be derived from a trusted membership lookup, never from chat text. */
  role?: TenantRole;
  tenantId?: string;
  uid?: string;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");
}

function compact(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function choose(items: string[], fallback: string) {
  return items.length ? items[Math.floor(Math.random() * items.length)] : fallback;
}

function containsPhrase(query: string, phrase: string) {
  const words = normalize(query).match(/[a-z0-9]+/g) ?? [];
  const phraseWords = normalize(phrase).split(/\s+/).filter(Boolean);
  return words.some((_, index) => phraseWords.every((word, offset) => words[index + offset] === word));
}

export function parseQBotQuery(
  raw: string,
  products: Product[],
  vocabulary: BotVocabulary = copyDefaultVocabulary(),
  context: QBotContext = {},
): QBotResult {
  const role = context.role ?? "worker";
  const tenantId = context.tenantId ?? DEFAULT_TENANT_ID;
  const respond = (intent: BotIntent | "SHOW_CARD", message: string, resultProducts: Product[] = []): QBotResult =>
    ({ intent, message, products: resultProducts, role, tenantId });
  const query = normalize(raw.replace(/@q\b/gi, " ")).trim();

  // Privacy policy: neither role may retrieve individual worker earnings or confidential records.
  const permission = classifyQBotPermission(query);
  if (permission === "financial_detail" || permission === "other_worker_earnings" || permission === "confidential_document") {
    return respond("SEARCH", "Từ chối vì lý do bảo mật: Q-Bot không cung cấp dữ liệu tài chính cá nhân hoặc tài liệu mật.");
  }
  if (role === "worker" && permission === "tenant_overview") {
    return respond("SEARCH", "Bạn không có quyền xem báo cáo tổng hợp hoặc dữ liệu vận hành toàn xưởng.");
  }
  if (permission === "personal_wallet") {
    return role === "worker"
      ? respond("SEARCH", "Ví thu nhập chỉ hiển thị cho chính bạn trong khu vực Ví cá nhân sau khi đăng nhập đúng tài khoản.")
      : respond("SEARCH", "Q-Bot không cung cấp dữ liệu ví cá nhân qua chat.");
  }

  const normalizedProducts = products
    .filter((product) => (product.tenantId ?? DEFAULT_TENANT_ID) === tenantId)
    .map((product) => {
      const fields = [product.id, product.name, product.brand, product.color, product.category, product.location, ...product.size, ...(product.search_keywords ?? [])];
      return { product, id: compact(product.id), idDigits: digits(compact(product.id)), searchable: compact(fields.join(" ")) };
    });
  const commandWords = new Set([
    "id", "ma", "hang", "doi", "cai", "mau", "san", "pham", "tim", "kiem", "giup", "cho", "minh",
    "con", "bao", "nhieu", "may", "ton", "so", "luong", "hien", "tai", "o", "dau", "nao", "khong",
    "nhe", "voi", "va", "la", "mot", "co", "khong", "ke",
  ]);
  for (const term of Object.values(vocabulary.intents).flat()) normalize(term).split(/\s+/).forEach((word) => commandWords.add(word));
  const hasIntent = (intent: keyof BotVocabulary["intents"], additions: string[] = []) =>
    [...vocabulary.intents[intent], ...additions].some((phrase) => containsPhrase(query, phrase));
  const quantityIntent = hasIntent("CHECK_QUANTITY", ["con", "ton", "bao nhieu"]);
  const locationIntent = hasIntent("CHECK_LOCATION", ["ke", "o dau"]);
  const greetingIntent = hasIntent("GREETING");
  const search = query.replace(/\b[a-z]-\d{1,3}\b/g, (code) => code.replace(/[^a-z0-9]/g, ""));
  const tokens = (search.match(/[a-z0-9]+/g) ?? []).filter((word) => !commandWords.has(word));

  if (!tokens.length) {
    if (greetingIntent) return respond("GREETING", choose(vocabulary.responses.GREETING, "Chào bạn! Q-Dcom sẵn sàng tra cứu kho."));
    return respond("SEARCH", choose(vocabulary.responses.NOT_FOUND, "Mình chưa tìm thấy mẫu hàng phù hợp."));
  }

  const matches = normalizedProducts.filter(({ idDigits, searchable }) => tokens.every((token) => {
    const tokenCompact = compact(token);
    if (searchable.includes(tokenCompact)) return true;
    const tokenDigits = digits(tokenCompact);
    return tokenDigits.length >= 3 && idDigits.includes(tokenDigits);
  }));

  const found = matches.slice(0, 4).map(({ product }) => product);
  if (found.length && quantityIntent) {
    return respond("CHECK_QUANTITY", `Mẫu ${found[0].name} (ID: ${found[0].id}) hiện còn ${found[0].quantity} sản phẩm trong kho.`, found);
  }
  if (found.length && locationIntent) {
    return respond("CHECK_LOCATION", `Mẫu ID ${found[0].id} đang được đặt tại ${found[0].location}.`, found);
  }
  if (found.length) return respond("SHOW_CARD", `Mình tìm thấy ${found.length} mẫu phù hợp.`, found);
  if (greetingIntent) return respond("GREETING", choose(vocabulary.responses.GREETING, "Chào bạn! Q-Dcom sẵn sàng tra cứu kho."));
  return respond("SEARCH", choose(vocabulary.responses.NOT_FOUND, "Mình chưa tìm thấy mẫu hàng phù hợp."));
}