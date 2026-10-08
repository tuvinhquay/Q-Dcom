import Dexie, { type Table } from "dexie";
import { initialProducts } from "@/data/mockProducts";
import { copyDefaultVocabulary, type BotVocabulary } from "@/lib/bot/vocabulary";
import type { Product } from "@/types/product";

export interface StoredVocabulary {
  id: "main";
  value: BotVocabulary;
}

export interface QDcomMember {
  peerId: string;
  displayName: string;
  email: string;
  avatar: string;
  addedAt: string;
}

class QDcomDatabase extends Dexie {
  products!: Table<Product, string>;
  botVocabulary!: Table<StoredVocabulary, "main">;
  members!: Table<QDcomMember, string>;

  constructor() {
    super("QDcom_Offline_DB");
    this.version(1).stores({
      products: "&id, name, brand, category, status, updated_at",
      botVocabulary: "&id",
      members: "&peerId, email, displayName",
    });

    this.on("populate", async () => {
      const legacyProducts = readLegacy<Product[]>("qdcom.products.v1");
      await this.products.bulkAdd(Array.isArray(legacyProducts) ? legacyProducts : initialProducts);
      const legacyVocabulary = readLegacy<BotVocabulary>("qdcom.bot-vocabulary.v1");
      await this.botVocabulary.put({ id: "main", value: legacyVocabulary ?? copyDefaultVocabulary() });
    });
  }
}

function readLegacy<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : undefined;
  } catch {
    return undefined;
  }
}

export const qdcomDB = new QDcomDatabase();