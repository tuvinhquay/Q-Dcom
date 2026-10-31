import {
  addDoc, collection, doc, getDoc, getDocs, limitToLast, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import { qdcomDB } from "@/lib/db/qdcomDB";
import { parseQBotQuery } from "@/lib/bot/qBotParser";
import { canAskQBot, classifyQBotPermission } from "@/lib/tenancy/authorization";
import type { Product } from "@/types/product";
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
  const orders = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data(), operationRates: [] } as unknown as PurchaseOrder));
  if (principal.role !== "admin") {
    void qdcomDB.purchaseOrders.bulkPut(orders.map((order) => ({ ...order, operationRates: [] }))).catch(() => undefined);
    return orders;
  }
  const ratesSnapshot = await getDocs(query(tenantCollection(principal.tenantId, "operationRates"), where("tenantId", "==", principal.tenantId)));
  const ratesByOrder = new Map<string, PurchaseOrder["operationRates"]>();
  for (const entry of ratesSnapshot.docs) {
    const rate = entry.data();
    const orderId = String(rate.purchaseOrderId ?? "");
    const list = ratesByOrder.get(orderId) ?? [];
    list.push({ operationId: String(rate.operationId), operationName: String(rate.operationName), unitRate: Number(rate.unitRate) });
    ratesByOrder.set(orderId, list);
  }
  const adminOrders = orders.map((order) => ({
    ...order,
    operationRates: ratesByOrder.get(order.id) ?? [],
    operations: ratesByOrder.get(order.id) ?? order.operations ?? [],
  }));
  // Do not cache confidential per-operation rates locally; the IndexedDB cache contains only worker-visible PO fields.
  void qdcomDB.purchaseOrders.bulkPut(adminOrders.map((order) => ({ ...order, operationRates: [] }))).catch(() => undefined);
  return adminOrders;
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
  void qdcomDB.purchaseOrders.put({ ...order, operationRates: [] }).catch(() => undefined);
}

export async function deleteWorkshopPurchaseOrder(principal: TenantPrincipal, orderId: string): Promise<void> {
  requireAdmin(principal);
  const orderRef = doc(tenantCollection(principal.tenantId, "purchaseOrders"), orderId);
  const order = await getDoc(orderRef);
  if (!order.exists()) return;
  requireTenant(principal, String(order.data().tenantId ?? ""));
  const [rates, production] = await Promise.all([
    getDocs(query(tenantCollection(principal.tenantId, "operationRates"), where("tenantId", "==", principal.tenantId), where("purchaseOrderId", "==", orderId))),
    getDocs(query(tenantCollection(principal.tenantId, "productionEntries"), where("tenantId", "==", principal.tenantId), where("purchaseOrderId", "==", orderId))),
  ]);
  if (!production.empty) throw new Error("Không thể xóa PO đã có lịch sử sản lượng; hãy giữ lại để bảo toàn lịch sử kiểm toán.");
  const batch = writeBatch(db());
  batch.delete(orderRef);
  rates.docs.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
  void qdcomDB.purchaseOrders.delete(orderId).catch(() => undefined);
}

export async function listWorkshopProductionEntries(principal: TenantPrincipal): Promise<ProductionEntry[]> {
  const constraints = [where("tenantId", "==", principal.tenantId)];
  if (principal.role === "worker") constraints.push(where("workerUid", "==", principal.uid));
  const snapshot = await getDocs(query(tenantCollection(principal.tenantId, "productionEntries"), ...constraints, orderBy("submittedAt", "desc")));
  const entries = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ProductionEntry));
  void qdcomDB.productionEntries.bulkPut(entries).catch(() => undefined);
  return entries;
}

export async function submitWorkshopProduction(principal: TenantPrincipal, entry: Omit<ProductionEntry, "id" | "status" | "submittedAt" | "reviewedAt" | "reviewedBy">): Promise<void> {
  if (principal.role !== "worker" || entry.workerUid !== principal.uid) throw new Error("Chỉ công nhân được gửi sản lượng của chính mình.");
  requireTenant(principal, entry.tenantId);
  if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) throw new Error("Sản lượng phải là số nguyên lớn hơn 0.");
  const entryRef = doc(tenantCollection(principal.tenantId, "productionEntries"));
  const localEntry: ProductionEntry = { ...entry, id: entryRef.id, tenantId: principal.tenantId, status: "pending", submittedAt: new Date().toISOString() };
  await setDoc(entryRef, { ...localEntry, submittedAt: serverTimestamp() });
  void qdcomDB.productionEntries.put(localEntry).catch(() => undefined);
}

export async function reviewWorkshopProduction(principal: TenantPrincipal, entryId: string, approve: boolean): Promise<void> {
  requireAdmin(principal);
  await updateDoc(doc(tenantCollection(principal.tenantId, "productionEntries"), entryId), {
    status: approve ? "approved" : "rejected", reviewedAt: serverTimestamp(), reviewedBy: principal.uid,
  });
  const cachedEntry = await qdcomDB.productionEntries.get(entryId);
  if (cachedEntry?.tenantId === principal.tenantId) {
    void qdcomDB.productionEntries.put({ ...cachedEntry, status: approve ? "approved" : "rejected", reviewedAt: new Date().toISOString(), reviewedBy: principal.uid }).catch(() => undefined);
  }
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
  const extraRef = doc(tenantCollection(principal.tenantId, "workerExtras"));
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
  const members = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as TenantMembership));
  void qdcomDB.tenantMemberships.bulkPut(members).catch(() => undefined);
  return members;
}

export async function getWorkshopSettings(principal: TenantPrincipal): Promise<TenantOperationsSettings | null> {
  const snapshot = await getDoc(doc(tenantCollection(principal.tenantId, "settings"), "operations"));
  if (!snapshot.exists()) return null;
  const settings = { id: snapshot.id, ...snapshot.data() } as TenantOperationsSettings;
  void qdcomDB.tenantSettings.put(settings).catch(() => undefined);
  return settings;
}

export async function saveWorkshopSettings(principal: TenantPrincipal, hours: number): Promise<void> {
  requireAdmin(principal);
  if (!Number.isFinite(hours) || hours < 1 || hours > 3) throw new Error("Khoảng nhắc nộp sản lượng phải từ 1 đến 3 giờ.");
  const settings: TenantOperationsSettings = { id: "operations", tenantId: principal.tenantId, submissionIntervalHours: hours, updatedAt: new Date().toISOString() };
  await setDoc(doc(tenantCollection(principal.tenantId, "settings"), "operations"), {
    ...settings, updatedAt: serverTimestamp(),
  });
  void qdcomDB.tenantSettings.put(settings).catch(() => undefined);
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
  const member: TenantMembership = { id: uid, tenantId: principal.tenantId, uid, role: "worker", displayName, employeeCode, active: true, createdAt: new Date().toISOString() };
  await setDoc(memberRef, { ...member, createdAt: serverTimestamp() });
  void qdcomDB.tenantMemberships.put(member).catch(() => undefined);
}

export interface WorkshopMessage {
  id: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: unknown;
}

export function watchWorkshopMessages(
  principal: TenantPrincipal,
  onChange: (messages: WorkshopMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const messages = collection(db(), "tenants", principal.tenantId, "rooms", "main", "messages");
  return onSnapshot(
    query(messages, where("tenantId", "==", principal.tenantId), orderBy("createdAt", "asc"), limitToLast(100)),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as WorkshopMessage))),
    onError,
  );
}

export async function sendWorkshopMessage(principal: TenantPrincipal, senderName: string, rawText: string): Promise<void> {
  const text = rawText.trim();
  if (!text || text.length > 4000) throw new Error("Tin nhắn phải có từ 1 đến 4000 ký tự.");
  await addDoc(collection(db(), "tenants", principal.tenantId, "rooms", "main", "messages"), {
    tenantId: principal.tenantId,
    senderId: principal.uid,
    senderName: senderName.trim().slice(0, 120),
    text,
    createdAt: serverTimestamp(),
  });
}

/** Produces a local-only answer for the signed-in member; the answer is never written to shared chat. */
export async function answerWorkshopQBot(principal: TenantPrincipal, question: string, products: Product[]): Promise<string> {
  const permission = classifyQBotPermission(question);
  if (["financial_detail", "other_worker_earnings", "confidential_document"].includes(permission)) {
    return "Từ chối vì lý do bảo mật: Q-Bot không cung cấp thu nhập cá nhân của người khác hoặc tài liệu mật.";
  }
  if (principal.role === "worker" && permission === "tenant_overview") {
    return "Bạn không có quyền xem báo cáo tổng hợp hoặc dữ liệu vận hành toàn xưởng.";
  }

  if (permission === "personal_wallet") {
    if (principal.role !== "worker") return "Q-Bot không cung cấp ví cá nhân qua chat cho vai trò này.";
    const wallet = await getMyEarnings(principal);
    return `Ví cá nhân của bạn: ${wallet.approvedQuantity.toLocaleString("vi-VN")} sản phẩm đã duyệt, thu nhập đã duyệt ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(wallet.approvedEarnings)}.`;
  }

  if (permission === "operation_procedure") {
    return "Chưa có tài liệu quy trình công đoạn được cấu hình cho xưởng này. Hãy nhờ Admin bổ sung hướng dẫn đã được duyệt.";
  }

  const inventoryAnswer = parseQBotQuery(question, products, undefined, {
    tenantId: principal.tenantId, role: principal.role, uid: principal.uid,
  });
  if (inventoryAnswer.products.length) return inventoryAnswer.message;
  if (permission === "inventory_lookup") return inventoryAnswer.message;

  if (principal.role === "admin" && permission === "tenant_overview") {
    const [orders, entries] = await Promise.all([
      listWorkshopPurchaseOrders(principal),
      listWorkshopProductionEntries(principal),
    ]);
    const approved = entries.filter((entry) => entry.status === "approved");
    const total = approved.reduce((sum, entry) => sum + entry.quantity, 0);
    const workerTotals = new Map<string, { name: string; quantity: number }>();
    for (const entry of approved) {
      const item = workerTotals.get(entry.workerUid) ?? { name: entry.workerName, quantity: 0 };
      item.quantity += entry.quantity;
      workerTotals.set(entry.workerUid, item);
    }
    const top = [...workerTotals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 3)
      .map((worker, index) => `${index + 1}. ${worker.name}: ${worker.quantity} sản phẩm`).join("; ");
    if (/po|don hang|danh sach/i.test(question.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      const list = orders.slice(0, 10).map((order) => `${order.poCode} · ${order.productName} · hạn ${order.dueAt}`).join("\n");
      return `Xưởng có ${orders.length} PO. ${list || "Chưa có PO."}`;
    }
    return `Báo cáo xưởng ${principal.tenantId}: ${orders.length} PO; ${total.toLocaleString("vi-VN")} sản phẩm đã được duyệt. Năng suất nổi bật: ${top || "chưa có dữ liệu"}.`;
  }

  const policy = canAskQBot(principal, question);
  return policy.allowed
    ? inventoryAnswer.message
    : policy.reason ?? "Q-Bot không thể trả lời yêu cầu này với quyền hiện tại.";
}
