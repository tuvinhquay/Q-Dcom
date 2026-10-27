import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { PurchaseOrder, ProductionEntry, TenantMembership, TenantOperationsSettings, WorkerExtra } from "@/types/tenant";
import type { TenantPrincipal } from "@/lib/tenancy/authorization";

const db = () => getFirebaseFirestore();
const tenantCollection = (tenantId: string, name: string) => collection(db(), "tenants", tenantId, name);
const rateId = (purchaseOrderId: string, operationId: string) => `${purchaseOrderId}__${operationId}`.replaceAll("/", "_");

function requireAdmin(principal: TenantPrincipal): void {
  if (principal.role !== "admin") throw new Error("Chỉ Admin được thực hiện thao tác này.");
}
function requireTenant(principal: TenantPrincipal, tenantId: string): void {
  if (!principal.uid || !principal.tenantId || principal.tenantId !== tenantId) throw new Error("Dữ liệu không thuộc xưởng hiện tại.");
}

export async function listWorkshopPurchaseOrders(principal: TenantPrincipal): Promise<PurchaseOrder[]> {
  const snapshot = await getDocs(query(tenantCollection(principal.tenantId, "purchaseOrders"), where("tenantId", "==", principal.tenantId), orderBy("dueAt", "asc")));
  const orders = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data(), operationRates: [] } as PurchaseOrder));
  if (principal.role !== "admin") return orders;
  const ratesSnapshot = await getDocs(query(tenantCollection(principal.tenantId, "operationRates"), where("tenantId", "==", principal.tenantId)));
  const ratesByOrder = new Map<string, PurchaseOrder["operationRates"]>();
  for (const entry of ratesSnapshot.docs) {
    const rate = entry.data();
    const orderId = String(rate.purchaseOrderId ?? "");
    const list = ratesByOrder.get(orderId) ?? [];
    list.push({ operationId: String(rate.operationId), operationName: String(rate.operationName), unitRate: Number(rate.unitRate) });
    ratesByOrder.set(orderId, list);
  }
  return orders.map((order) => ({
    ...order,
    operationRates: ratesByOrder.get(order.id) ?? [],
    operations: ratesByOrder.get(order.id) ?? order.operations ?? [],
  }));
}

export async function saveWorkshopPurchaseOrder(principal: TenantPrincipal, order: PurchaseOrder): Promise<void> {
  requireAdmin(principal);
  requireTenant(principal, order.tenantId);
  if (!order.poCode.trim() || !order.productName.trim() || !Number.isSafeInteger(order.totalQuantity) || order.totalQuantity <= 0) {
    throw new Error("Mã PO, tên sản phẩm và số lượng tổng phải hợp lệ.");
  }
  if (Number.isNaN(Date.parse(order.receivedAt)) || Number.isNaN(Date.parse(order.dueAt)) || order.dueAt < order.receivedAt) {
    throw new Error("Ngày nhập kho hoặc hạn xuất hàng không hợp lệ.");
  }
  if (order.operationRates.some((rate) => !rate.operationId.trim() || !rate.operationName.trim() || !Number.isFinite(rate.unitRate) || rate.unitRate < 0)) {
    throw new Error("Đơn giá công đoạn không hợp lệ.");
  }
  const { operationRates, ...orderData } = order;
  const ratesCollection = tenantCollection(principal.tenantId, "operationRates");
  const oldRates = await getDocs(query(ratesCollection, where("tenantId", "==", principal.tenantId), where("purchaseOrderId", "==", order.id)));
  const batch = writeBatch(db());
  batch.set(doc(tenantCollection(principal.tenantId, "purchaseOrders"), order.id), {
    ...orderData,
    operations: operationRates.map(({ operationId, operationName }) => ({ operationId, operationName })),
    tenantId: principal.tenantId,
    updatedAt: new Date().toISOString(),
  });
  oldRates.docs.forEach((entry) => batch.delete(entry.ref));
  for (const rate of operationRates) {
    batch.set(doc(ratesCollection, rateId(order.id, rate.operationId)), {
      ...rate, tenantId: principal.tenantId, purchaseOrderId: order.id,
    });
  }
  await batch.commit();
}

export async function deleteWorkshopPurchaseOrder(principal: TenantPrincipal, orderId: string): Promise<void> {
  requireAdmin(principal);
  const orderRef = doc(tenantCollection(principal.tenantId, "purchaseOrders"), orderId);
  const order = await getDoc(orderRef);
  if (!order.exists()) return;
  requireTenant(principal, String(order.data().tenantId ?? ""));
  const rates = await getDocs(query(tenantCollection(principal.tenantId, "operationRates"), where("tenantId", "==", principal.tenantId), where("purchaseOrderId", "==", orderId)));
  const batch = writeBatch(db());
  batch.delete(orderRef);
  rates.docs.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
}

export async function listWorkshopProductionEntries(principal: TenantPrincipal): Promise<ProductionEntry[]> {
  const constraints = [where("tenantId", "==", principal.tenantId)];
  if (principal.role === "worker") constraints.push(where("workerUid", "==", principal.uid));
  const snapshot = await getDocs(query(tenantCollection(principal.tenantId, "productionEntries"), ...constraints, orderBy("submittedAt", "desc")));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ProductionEntry));
}

export async function submitWorkshopProduction(principal: TenantPrincipal, entry: Omit<ProductionEntry, "id" | "status" | "submittedAt" | "reviewedAt" | "reviewedBy">): Promise<void> {
  if (principal.role !== "worker" || entry.workerUid !== principal.uid) throw new Error("Chỉ công nhân được gửi sản lượng của chính mình.");
  requireTenant(principal, entry.tenantId);
  if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) throw new Error("Sản lượng phải là số nguyên lớn hơn 0.");
  const entryRef = doc(collection(tenantCollection(principal.tenantId, "productionEntries")));
  await setDoc(entryRef, { ...entry, id: entryRef.id, tenantId: principal.tenantId, status: "pending", submittedAt: serverTimestamp() });
}

export async function reviewWorkshopProduction(principal: TenantPrincipal, entryId: string, approve: boolean): Promise<void> {
  requireAdmin(principal);
  await updateDoc(doc(tenantCollection(principal.tenantId, "productionEntries"), entryId), {
    status: approve ? "approved" : "rejected", reviewedAt: serverTimestamp(), reviewedBy: principal.uid,
  });
}

export async function listWorkshopExtras(principal: TenantPrincipal): Promise<WorkerExtra[]> {
  const constraints = [where("tenantId", "==", principal.tenantId)];
  if (principal.role === "worker") constraints.push(where("workerUid", "==", principal.uid));
  else constraints.push(where("status", "==", "pending"));
  const snapshot = await getDocs(query(tenantCollection(principal.tenantId, "workerExtras"), ...constraints, orderBy("submittedAt", "desc")));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as WorkerExtra));
}

export async function submitWorkshopExtra(principal: TenantPrincipal, extra: Omit<WorkerExtra, "id" | "status" | "submittedAt" | "reviewedAt" | "reviewedBy">): Promise<void> {
  if (principal.role !== "worker" || extra.workerUid !== principal.uid) throw new Error("Chỉ công nhân được gửi phụ phí của chính mình.");
  requireTenant(principal, extra.tenantId);
  if (!Number.isFinite(extra.amount) || extra.amount < 0 || !extra.description.trim()) throw new Error("Khoản phụ phí chưa hợp lệ.");
  const extraRef = doc(collection(tenantCollection(principal.tenantId, "workerExtras")));
  await setDoc(extraRef, { ...extra, id: extraRef.id, tenantId: principal.tenantId, status: "pending", submittedAt: serverTimestamp() });
}

export async function reviewWorkshopExtra(principal: TenantPrincipal, extraId: string, approve: boolean): Promise<void> {
  requireAdmin(principal);
  await updateDoc(doc(tenantCollection(principal.tenantId, "workerExtras"), extraId), {
    status: approve ? "approved" : "rejected", reviewedAt: serverTimestamp(), reviewedBy: principal.uid,
  });
}

export async function listWorkshopMembers(principal: TenantPrincipal): Promise<TenantMembership[]> {
  requireAdmin(principal);
  const snapshot = await getDocs(query(tenantCollection(principal.tenantId, "members"), where("tenantId", "==", principal.tenantId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as TenantMembership));
}

export async function getWorkshopSettings(principal: TenantPrincipal): Promise<TenantOperationsSettings | null> {
  const snapshot = await getDoc(doc(tenantCollection(principal.tenantId, "settings"), "operations"));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as TenantOperationsSettings) : null;
}

export async function saveWorkshopSettings(principal: TenantPrincipal, hours: number): Promise<void> {
  requireAdmin(principal);
  if (!Number.isFinite(hours) || hours < 1 || hours > 3) throw new Error("Khoảng nhắc nộp sản lượng phải từ 1 đến 3 giờ.");
  await setDoc(doc(tenantCollection(principal.tenantId, "settings"), "operations"), {
    id: "operations", tenantId: principal.tenantId, submissionIntervalHours: hours, updatedAt: serverTimestamp(),
  });
}

export async function getMyEarnings(principal: TenantPrincipal): Promise<{ approvedQuantity: number; approvedEarnings: number; periods: Array<Record<string, unknown>> }> {
  if (principal.role !== "worker") throw new Error("Ví thu nhập chỉ dành cho tài khoản công nhân.");
  const ref = doc(tenantCollection(principal.tenantId, "earnings"), principal.uid);
  const [summary, periodSnapshot] = await Promise.all([
    getDoc(ref),
    getDocs(query(collection(ref, "periods"), where("tenantId", "==", principal.tenantId), orderBy("periodKey", "desc"))),
  ]);
  const data = summary.data();
  return {
    approvedQuantity: Number(data?.approvedQuantity ?? 0),
    approvedEarnings: Number(data?.approvedEarnings ?? 0),
    periods: periodSnapshot.docs.map((entry) => entry.data()),
  };
}

export async function addWorkshopWorker(principal: TenantPrincipal, input: { uid: string; displayName: string; employeeCode: string }): Promise<void> {
  requireAdmin(principal);
  const uid = input.uid.trim();
  const displayName = input.displayName.trim();
  const employeeCode = input.employeeCode.trim();
  if (!uid || !displayName || !employeeCode) throw new Error("Cần nhập UID Google, tên công nhân và mã thẻ.");
  const memberRef = doc(tenantCollection(principal.tenantId, "members"), uid);
  await setDoc(memberRef, {
    tenantId: principal.tenantId, uid, role: "worker", displayName, employeeCode,
    active: true, createdAt: serverTimestamp(),
  });
}
