import type { Product } from "@/types/product";
import { copyDefaultVocabulary, type BotIntent, type BotVocabulary } from "./vocabulary";

export interface QBotResult { intent: BotIntent | "SHOW_CARD"; message: string; products: Product[] }

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

export function parseQBotQuery(raw: string, products: Product[], vocabulary: BotVocabulary = copyDefaultVocabulary()): QBotResult {
  const query = normalize(raw.replace(/@q\b/gi, " ")).trim();
  const normalizedProducts = products.map((product) => {
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
    if (greetingIntent) return { intent: "GREETING", products: [], message: choose(vocabulary.responses.GREETING, "Chào bạn! Q-Dcom sẵn sàng tra cứu kho.") };
    return { intent: "SEARCH", products: [], message: choose(vocabulary.responses.NOT_FOUND, "Mình chưa tìm thấy mẫu hàng phù hợp.") };
  }

  const matches = normalizedProducts.filter(({ idDigits, searchable }) => tokens.every((token) => {
    const tokenCompact = compact(token);
    if (searchable.includes(tokenCompact)) return true;
    const tokenDigits = digits(tokenCompact);
    return tokenDigits.length >= 3 && idDigits.includes(tokenDigits);
  }));

  const found = matches.slice(0, 4).map(({ product }) => product);
  if (found.length && quantityIntent) {
    return { intent: "CHECK_QUANTITY", products: found, message: `Mẫu ${found[0].name} (ID: ${found[0].id}) hiện còn ${found[0].quantity} sản phẩm trong kho.` };
  }
  if (found.length && locationIntent) {
    return { intent: "CHECK_LOCATION", products: found, message: `Mẫu ID ${found[0].id} đang được đặt tại ${found[0].location}.` };
  }
  if (found.length) return { intent: "SHOW_CARD", products: found, message: `Mình tìm thấy ${found.length} mẫu phù hợp.` };
  if (greetingIntent) return { intent: "GREETING", products: [], message: choose(vocabulary.responses.GREETING, "Chào bạn! Q-Dcom sẵn sàng tra cứu kho.") };
  return { intent: "SEARCH", products: [], message: choose(vocabulary.responses.NOT_FOUND, "Mình chưa tìm thấy mẫu hàng phù hợp.") };
}