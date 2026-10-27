import { qdcomDB } from "@/lib/db/qdcomDB";
import type { PurchaseOrder, ProductionEntry, TenantMembership, TenantOperationsSettings, WorkerExtra } from "@/types/tenant";
import { assertSameTenant, type TenantPrincipal } from "@/lib/tenancy/authorization";

function requireTenant<T extends { tenantId: string }>(principal: TenantPrincipal, record: T): T {
  assertSameTenant(principal, record.tenantId);
  return record;
}

export async function listPurchaseOrders(principal: TenantPrincipal): Promise<PurchaseOrder[]> {
  return qdcomDB.purchaseOrders.where("tenantId").equals(principal.tenantId).toArray();
}

export async function savePurchaseOrder(principal: TenantPrincipal, order: PurchaseOrder): Promise<void> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được quản lý đơn hàng PO.");
  requireTenant(principal, order);
  if (!order.poCode.trim() || !order.productName.trim() || order.totalQuantity <= 0) throw new Error("Thông tin PO chưa hợp lệ.");
  if (Number.isNaN(Date.parse(order.receivedAt)) || Number.isNaN(Date.parse(order.dueAt)) || order.dueAt < order.receivedAt) {
    throw new Error("Ngày nhập kho và hạn xuất hàng không hợp lệ.");
  }
  if (order.operationRates.some((rate) => !rate.operationName.trim() || !Number.isFinite(rate.unitRate) || rate.unitRate < 0)) {
    throw new Error("Đơn giá công đoạn không hợp lệ.");
  }
  await qdcomDB.purchaseOrders.put(order);
}

export async function deletePurchaseOrder(principal: TenantPrincipal, orderId: string): Promise<void> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được xóa đơn hàng PO.");
  const order = await qdcomDB.purchaseOrders.get(orderId);
  if (!order) return;
  requireTenant(principal, order);
  await qdcomDB.purchaseOrders.delete(orderId);
}

export async function submitProduction(principal: TenantPrincipal, entry: ProductionEntry): Promise<void> {
  if (principal.role !== "worker" || entry.workerUid !== principal.uid) throw new Error("Chỉ công nhân có thể gửi sản lượng của chính mình.");
  requireTenant(principal, entry);
  if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) throw new Error("Sản lượng phải là số nguyên lớn hơn 0.");
  await qdcomDB.productionEntries.put({ ...entry, status: "pending" });
}

export async function submitWorkerExtra(principal: TenantPrincipal, extra: WorkerExtra): Promise<void> {
  if (principal.role !== "worker" || extra.workerUid !== principal.uid) throw new Error("Chỉ công nhân có thể gửi phụ phí của chính mình.");
  requireTenant(principal, extra);
  if (!Number.isFinite(extra.amount) || extra.amount < 0 || !extra.description.trim()) throw new Error("Khoản phụ phí chưa hợp lệ.");
  await qdcomDB.workerExtras.put({ ...extra, status: "pending" });
}

export async function reviewProduction(principal: TenantPrincipal, entryId: string, approve: boolean): Promise<void> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được duyệt sản lượng.");
  const entry = await qdcomDB.productionEntries.get(entryId);
  if (!entry) throw new Error("Không tìm thấy báo cáo sản lượng.");
  requireTenant(principal, entry);
  await qdcomDB.productionEntries.put({ ...entry, status: approve ? "approved" : "rejected", reviewedAt: new Date().toISOString(), reviewedBy: principal.uid });
}

export async function reviewWorkerExtra(principal: TenantPrincipal, extraId: string, approve: boolean): Promise<void> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được duyệt phụ phí.");
  const extra = await qdcomDB.workerExtras.get(extraId);
  if (!extra) throw new Error("Không tìm thấy khoản phụ phí.");
  requireTenant(principal, extra);
  await qdcomDB.workerExtras.put({ ...extra, status: approve ? "approved" : "rejected", reviewedAt: new Date().toISOString(), reviewedBy: principal.uid });
}

export async function listTenantMemberships(principal: TenantPrincipal): Promise<TenantMembership[]> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được xem danh sách thành viên xưởng.");
  return qdcomDB.tenantMemberships.where("tenantId").equals(principal.tenantId).toArray();
}

export async function getTenantOperationsSettings(principal: TenantPrincipal): Promise<TenantOperationsSettings | undefined> {
  return qdcomDB.tenantSettings.get(principal.tenantId);
}

export async function saveTenantOperationsSettings(principal: TenantPrincipal, hours: number): Promise<void> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được cấu hình nhắc nộp sản lượng.");
  if (!Number.isFinite(hours) || hours < 1 || hours > 3) throw new Error("Khoảng nhắc nộp sản lượng phải từ 1 đến 3 giờ.");
  await qdcomDB.tenantSettings.put({ id: principal.tenantId, tenantId: principal.tenantId, submissionIntervalHours: hours, updatedAt: new Date().toISOString() });
}

/** Deliberately excludes individual earnings from all admin-facing report APIs. */
export async function getTenantProductivity(principal: TenantPrincipal): Promise<Array<{ workerUid: string; workerName: string; approvedQuantity: number; pendingQuantity: number }>> {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được xem báo cáo năng suất tổng hợp.");
  const entries = await qdcomDB.productionEntries.where("tenantId").equals(principal.tenantId).toArray();
  const totals = new Map<string, { workerUid: string; workerName: string; approvedQuantity: number; pendingQuantity: number }>();
  for (const entry of entries) {
    const item = totals.get(entry.workerUid) ?? { workerUid: entry.workerUid, workerName: entry.workerName, approvedQuantity: 0, pendingQuantity: 0 };
    if (entry.status === "approved") item.approvedQuantity += entry.quantity;
    if (entry.status === "pending") item.pendingQuantity += entry.quantity;
    totals.set(entry.workerUid, item);
  }
  return [...totals.values()].sort((a, b) => b.approvedQuantity - a.approvedQuantity);
}

export async function getPersonalEarnings(principal: TenantPrincipal, workerUid: string): Promise<{ approvedQuantity: number; approvedEarnings: number }> {
  if (principal.role !== "worker" || principal.uid !== workerUid) throw new Error("Ví thu nhập chỉ được xem bởi chính công nhân đó.");
  const [entries, extras] = await Promise.all([
    qdcomDB.productionEntries.where("tenantId").equals(principal.tenantId).toArray(),
    qdcomDB.workerExtras.where("tenantId").equals(principal.tenantId).toArray(),
  ]);
  const personalEntries = entries.filter((entry) => entry.workerUid === workerUid && entry.status === "approved");
  const personalExtras = extras.filter((entry) => entry.workerUid === workerUid && entry.status === "approved");
  const rates = new Map<string, number>();
  const orders = await qdcomDB.purchaseOrders.where("tenantId").equals(principal.tenantId).toArray();
  for (const order of orders) for (const rate of order.operationRates) rates.set(`${order.id}:${rate.operationId}`, rate.unitRate);
  return {
    approvedQuantity: personalEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    approvedEarnings: personalEntries.reduce((sum, entry) => sum + entry.quantity * (rates.get(`${entry.purchaseOrderId}:${entry.operationId}`) ?? 0), 0)
      + personalExtras.reduce((sum, extra) => sum + extra.amount, 0),
  };
}
