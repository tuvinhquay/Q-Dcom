/** Khai báo schema IndexedDB và các kiểu dữ liệu local-first của Q-Dcom. */
import Dexie, { type Table } from "dexie";
import { initialProducts } from "@/data/mockProducts";
import { copyDefaultVocabulary, type BotVocabulary } from "@/lib/bot/vocabulary";
import type { Product } from "@/types/product";

/** Các trường do cơ sở tự định nghĩa, được tách riêng theo ngành nghề. */
export interface IndustryCustomField {
  id: string;
  industryType: string;
  label: string;
  type: "text" | "number" | "date";
  unit: string;
  createdAt: string;
}

/** Một bản ghi sản lượng cùng giá trị của các trường tùy chỉnh tại thời điểm nhập. */
export interface ProductionRecord {
  id: string;
  industryType: string;
  date: string;
  line: string;
  shift: string;
  quantity: number;
  note: string;
  customFields: Array<Pick<IndustryCustomField, "id" | "label" | "unit">>;
  customValues: Record<string, string>;
  createdAt: string;
}

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

export interface LocalProductionRecord {
  id: string;
  ownerUid: string;
  groupId: string;
  kind: "group" | "order" | "stage" | "field" | "entry";
  data: Record<string, unknown>;
  updatedAt: string;
}

class QDcomDatabase extends Dexie {
  products!: Table<Product, string>;
  botVocabulary!: Table<StoredVocabulary, "main">;
  members!: Table<QDcomMember, string>;
  industryCustomFields!: Table<IndustryCustomField, string>;
  productionRecords!: Table<ProductionRecord, string>;
  localProduction!: Table<LocalProductionRecord, string>;

  constructor() {
    super("QDcom_Offline_DB");
    this.version(1).stores({
      products: "&id, name, brand, category, status, updated_at",
      botVocabulary: "&id",
      members: "&peerId, email, displayName",
    });
    // Schema v2 bổ sung cấu hình field và lịch sử sản lượng mà không thay đổi bảng hiện có.
    this.version(2).stores({
      products: "&id, name, brand, category, status, updated_at",
      botVocabulary: "&id",
      members: "&peerId, email, displayName",
      industryCustomFields: "&id, industryType, label",
      productionRecords: "&id, industryType, date",
    });
    this.version(3).stores({
      products: "&id, name, brand, category, status, updated_at",
      botVocabulary: "&id",
      members: "&peerId, email, displayName",
      industryCustomFields: "&id, industryType, label",
      productionRecords: "&id, industryType, date",
      localProduction: "&id, ownerUid, groupId, kind, [ownerUid+kind], [ownerUid+groupId+kind]",
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