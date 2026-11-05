import Dexie, { type Table } from "dexie";
import { initialProducts } from "@/data/mockProducts";
import { copyDefaultVocabulary, type BotVocabulary } from "@/lib/bot/vocabulary";
import type { Product } from "@/types/product";
import type { PurchaseOrder, ProductionEntry, TenantMembership, TenantOperationsSettings, WorkerExtra } from "@/types/tenant";

export const DEFAULT_TENANT_ID = "local-default";

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
  purchaseOrders!: Table<PurchaseOrder, string>;
  productionEntries!: Table<ProductionEntry, string>;
  workerExtras!: Table<WorkerExtra, string>;
  tenantMemberships!: Table<TenantMembership, string>;
  tenantSettings!: Table<TenantOperationsSettings, string>;

  constructor() {
    super("QDcom_Offline_DB");
    this.version(1).stores({
      products: "&id, name, brand, category, status, updated_at",
      botVocabulary: "&id",
      members: "&peerId, email, displayName",
    });

    this.version(2).stores({
      products: "&id, tenantId, [tenantId+updated_at], name, brand, category, status, updated_at",
      botVocabulary: "&id",
      members: "&peerId, email, displayName",
      purchaseOrders: "&id, tenantId, poCode, dueAt, [tenantId+dueAt]",
      productionEntries: "&id, tenantId, workerUid, purchaseOrderId, workDate, status, [tenantId+workerUid], [tenantId+status]",
      workerExtras: "&id, tenantId, workerUid, workDate, status, [tenantId+workerUid], [tenantId+status]",
      tenantMemberships: "&id, tenantId, uid, employeeCode, [tenantId+uid]",
      tenantSettings: "&id, tenantId",
    }).upgrade(async (transaction) => {
      // Preserve all existing stock records by placing legacy data in one isolated local tenant.
      await transaction.table("products").toCollection().modify((product: Product) => {
        product.tenantId = product.tenantId || DEFAULT_TENANT_ID;
      });
    });

    this.on("populate", async () => {
      const legacyProducts = readLegacy<Product[]>("qdcom.products.v1");
      const products = Array.isArray(legacyProducts) ? legacyProducts : initialProducts;
      await this.products.bulkAdd(products.map((product) => ({ ...product, tenantId: product.tenantId || DEFAULT_TENANT_ID })));
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