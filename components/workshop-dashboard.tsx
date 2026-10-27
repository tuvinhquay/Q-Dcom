"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { AlertTriangle, Clock3, Factory, MessageCircle, Plus, RefreshCw, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import { getFirebaseAuth, isFirebaseConfigured, signInWithGooglePopup, signOutFirebaseUser } from "@/lib/firebase";
import { createTenant, getTenantPrincipal } from "@/lib/services/tenantService";
import {
  addWorkshopWorker, deleteWorkshopPurchaseOrder, getMyEarnings, getWorkshopSettings,
  listWorkshopExtras, listWorkshopMembers, listWorkshopProductionEntries, listWorkshopPurchaseOrders,
  reviewWorkshopExtra, reviewWorkshopProduction, saveWorkshopPurchaseOrder, saveWorkshopSettings,
  sendWorkshopMessage, submitWorkshopExtra, submitWorkshopProduction, watchWorkshopMessages,
  type WorkshopMessage,
} from "@/lib/services/workshopFirestoreService";
import type { TenantPrincipal } from "@/lib/tenancy/authorization";
import type { PurchaseOrder, ProductionEntry, TenantMembership, TenantOperationsSettings, WorkerExtra } from "@/types/tenant";

type Props = { initialUid?: string; displayName?: string };
type Earnings = { approvedQuantity: number; approvedEarnings: number; periods: Array<Record<string, unknown>> };

function newId() { return globalThis.crypto?.randomUUID?.() ?? `qd-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function dateTime(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as {toMillis?: unknown}).toMillis === "function") {
    return (value as {toMillis: () => number}).toMillis();
  }
  const result = Date.parse(String(value ?? ""));
  return Number.isFinite(result) ? result : 0;
}
function money(value: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
function statusLabel(status: string) { return status === "approved" ? "Đã duyệt" : status === "rejected" ? "Từ chối" : "Chờ duyệt"; }
function operationId(name: string) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase(); }
function isInPeriod(dateValue: string, period: string): boolean {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return false;
  if (period === "day") return date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  if (period === "week") {
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const nextMonday = new Date(monday); nextMonday.setUTCDate(monday.getUTCDate() + 7);
    return date >= monday && date < nextMonday;
  }
  if (period === "month") return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
  if (period === "quarter") return date.getUTCFullYear() === now.getUTCFullYear() && Math.floor(date.getUTCMonth() / 3) === Math.floor(now.getUTCMonth() / 3);
  return date.getUTCFullYear() === now.getUTCFullYear();
}

export function WorkshopDashboard({ initialUid, displayName = "" }: Props) {
  const [uid, setUid] = useState(initialUid ?? "");
  const [signedInName, setSignedInName] = useState(displayName);
  const [tenantIdInput, setTenantIdInput] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [principal, setPrincipal] = useState<TenantPrincipal | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [extras, setExtras] = useState<WorkerExtra[]>([]);
  const [members, setMembers] = useState<TenantMembership[]>([]);
  const [settings, setSettings] = useState<TenantOperationsSettings | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [mountedAt, setMountedAt] = useState(0);
  const [poCode, setPoCode] = useState("");
  const [productName, setProductName] = useState("");
  const [color, setColor] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("100");
  const [receivedAt, setReceivedAt] = useState(today());
  const [dueAt, setDueAt] = useState(today());
  const [operationName, setOperationName] = useState("");
  const [unitRate, setUnitRate] = useState("0");
  const [customOperationName, setCustomOperationName] = useState("");
  const [walletPeriod, setWalletPeriod] = useState("month");
  const [rankingPeriod, setRankingPeriod] = useState("month");
  const [editingOrderId, setEditingOrderId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [productionQuantity, setProductionQuantity] = useState("1");
  const [productionDate, setProductionDate] = useState(today());
  const [extraCategory, setExtraCategory] = useState<WorkerExtra["category"]>("overtime");
  const [extraDescription, setExtraDescription] = useState("");
  const [extraAmount, setExtraAmount] = useState("0");
  const [workerUid, setWorkerUid] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerCode, setWorkerCode] = useState("");
  const [intervalHours, setIntervalHours] = useState("2");
  const [chatMessages, setChatMessages] = useState<WorkshopMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      setUid(user?.uid ?? "");
      setSignedInName(user?.displayName ?? displayName);
    });
  }, [initialUid, displayName]);

  useEffect(() => {
    if (!principal) { setChatMessages([]); return; }
    return watchWorkshopMessages(principal, setChatMessages, (reason) => setError(reason.message));
  }, [principal]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      setMountedAt((current) => current || now);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadData = useCallback(async (active: TenantPrincipal) => {
    const results = await Promise.all([
      listWorkshopPurchaseOrders(active),
      listWorkshopProductionEntries(active),
      listWorkshopExtras(active),
      getWorkshopSettings(active),
      active.role === "admin" ? listWorkshopMembers(active) : Promise.resolve([] as TenantMembership[]),
      active.role === "worker" ? getMyEarnings(active) : Promise.resolve(null),
    ] as const);
    setOrders(results[0]);
    setEntries(results[1]);
    setExtras(results[2]);
    setSettings(results[3]);
    setMembers(results[4]);
    setEarnings(results[5]);
    setIntervalHours(String(results[3]?.submissionIntervalHours ?? 2));
    if (!selectedOrderId && results[0][0]) setSelectedOrderId(results[0][0].id);
  }, [selectedOrderId]);

  async function connectTenant() {
    setBusy(true); setError(""); setNotice("");
    try {
      const active = await getTenantPrincipal(uid, tenantIdInput.trim(), employeeCode.trim());
      setPrincipal(active);
      setActiveTenantId(active.tenantId);
      setTenantIdInput(active.tenantId);
      await loadData(active);
      setNotice(`Đã kết nối xưởng · quyền ${active.role === "admin" ? "Quản lý" : "Công nhân"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể kết nối xưởng.");
      setPrincipal(null);
    } finally { setBusy(false); }
  }

  async function makeTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const id = await createTenant({ name: tenantName, uid, displayName: signedInName || workerName || "Quản lý xưởng", employeeCode });
      setTenantIdInput(id);
      const active = await getTenantPrincipal(uid, id);
      setPrincipal(active);
      setActiveTenantId(active.tenantId);
      await loadData(active);
      setNotice(`Đã tạo xưởng. Hãy lưu mã xưởng: ${id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo xưởng."); }
    finally { setBusy(false); }
  }

  async function refresh() {
    if (!principal) return;
    setBusy(true); setError("");
    try { await loadData(principal); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu xưởng."); }
    finally { setBusy(false); }
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!principal) return;
    setBusy(true); setError("");
    const operationNames = operationName.split(",").map((item) => item.trim()).filter(Boolean);
    const rateValues = unitRate.split(",").map((item) => Number(item.trim()));
    if (!operationNames.length || operationNames.length !== rateValues.length || rateValues.some((rate) => !Number.isFinite(rate) || rate < 0)) {
      setError("Hãy nhập tên công đoạn và đơn giá tương ứng, ngăn cách bằng dấu phẩy.");
      setBusy(false);
      return;
    }
    const operationRates = operationNames.map((name, index) => ({ operationId: operationId(name), operationName: name, unitRate: rateValues[index] }));
    if (new Set(operationRates.map((rate) => rate.operationId)).size !== operationRates.length) {
      setError("Tên công đoạn bị trùng. Hãy đặt tên mỗi công đoạn khác nhau.");
      setBusy(false);
      return;
    }
    const order: PurchaseOrder = {
      id: editingOrderId || newId(), tenantId: principal.tenantId, poCode: poCode.trim(), productName: productName.trim(),
      color: color.trim(), totalQuantity: Number(totalQuantity), receivedAt, dueAt,
      operationRates,
      operations: operationRates.map(({ operationId, operationName }) => ({ operationId, operationName })),
      createdAt: editingOrderId ? (orders.find((item) => item.id === editingOrderId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveWorkshopPurchaseOrder(principal, order);
      setPoCode(""); setProductName(""); setColor(""); setTotalQuantity("100"); setOperationName(""); setUnitRate("0"); setEditingOrderId("");
      await refresh(); setNotice("Đã lưu đơn hàng PO.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu PO."); }
    finally { setBusy(false); }
  }

  function editOrder(order: PurchaseOrder) {
    setEditingOrderId(order.id); setPoCode(order.poCode); setProductName(order.productName); setColor(order.color);
    setTotalQuantity(String(order.totalQuantity)); setReceivedAt(order.receivedAt); setDueAt(order.dueAt);
    setOperationName((order.operationRates.length ? order.operationRates : order.operations ?? []).map((item) => item.operationName).join(", "));
    setUnitRate(order.operationRates.map((item) => String(item.unitRate)).join(", ") || "0");
  }

  async function submitProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!principal || principal.role !== "worker") return;
    const order = orders.find((item) => item.id === selectedOrderId);
    const operation = order?.operations?.find((item) => item.operationId === selectedOperationId)
      ?? (customOperationName.trim() && selectedOperationId === operationId(customOperationName) ? { operationId: selectedOperationId, operationName: customOperationName.trim() } : undefined)
      ?? order?.operations?.[0];
    if (!order || !operation) { setError("Hãy chọn PO có công đoạn hợp lệ."); return; }
    setBusy(true); setError("");
    try {
      await submitWorkshopProduction(principal, {
        tenantId: principal.tenantId, workerUid: principal.uid, workerName: signedInName || principal.uid,
        purchaseOrderId: order.id, operationId: operation.operationId, operationName: operation.operationName,
        quantity: Number(productionQuantity), workDate: productionDate,
      });
      setCustomOperationName("");
      setNotice("Đã gửi sản lượng, đang chờ Admin duyệt. Công đoạn phát sinh cần Admin thiết lập đơn giá trên PO để tính ví."); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi sản lượng."); }
    finally { setBusy(false); }
  }

  async function submitExtra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!principal || principal.role !== "worker") return;
    setBusy(true); setError("");
    try {
      await submitWorkshopExtra(principal, {
        tenantId: principal.tenantId, workerUid: principal.uid, category: extraCategory,
        description: extraDescription.trim(), amount: Number(extraAmount), workDate: today(),
      });
      setExtraDescription(""); setExtraAmount("0"); setNotice("Đã gửi khoản phụ phí, đang chờ Admin duyệt."); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi phụ phí."); }
    finally { setBusy(false); }
  }

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!principal) return;
    setBusy(true); setError("");
    try {
      await addWorkshopWorker(principal, { uid: workerUid, displayName: workerName, employeeCode: workerCode });
      setWorkerUid(""); setWorkerName(""); setWorkerCode(""); await refresh(); setNotice("Đã thêm công nhân. Người này cần đăng nhập Google bằng đúng UID đã khai báo.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể thêm công nhân."); }
    finally { setBusy(false); }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!principal || !chatDraft.trim()) return;
    setBusy(true); setError("");
    try {
      await sendWorkshopMessage(principal, signedInName || principal.uid, chatDraft);
      setChatDraft("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi tin nhắn xưởng."); }
    finally { setBusy(false); }
  }

  async function reviewEntry(id: string, approve: boolean) {
    if (!principal) return;
    setBusy(true); setError("");
    try { await reviewWorkshopProduction(principal, id, approve); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể duyệt sản lượng."); }
    finally { setBusy(false); }
  }
  async function reviewExtra(id: string, approve: boolean) {
    if (!principal) return;
    setBusy(true); setError("");
    try { await reviewWorkshopExtra(principal, id, approve); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể duyệt phụ phí."); }
    finally { setBusy(false); }
  }

  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();
    for (const entry of entries) if (entry.status === "approved" && isInPeriod(entry.workDate, rankingPeriod)) {
      const current = map.get(entry.workerUid) ?? { name: entry.workerName, quantity: 0 };
      current.quantity += entry.quantity; map.set(entry.workerUid, current);
    }
    return [...map.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.quantity - a.quantity);
  }, [entries, rankingPeriod]);
  const averageQuantity = ranking.length ? ranking.reduce((sum, item) => sum + item.quantity, 0) / ranking.length : 0;
  const lastSubmit = entries.reduce((latest, entry) => Math.max(latest, dateTime(entry.submittedAt)), 0);
  const intervalMs = Number(settings?.submissionIntervalHours ?? intervalHours) * 3600000;
  const nextSubmit = (lastSubmit || mountedAt || tick) + intervalMs;
  const remaining = Math.max(0, nextSubmit - tick);
  const countdown = `${String(Math.floor(remaining / 3600000)).padStart(2,"0")}:${String(Math.floor(remaining / 60000) % 60).padStart(2,"0")}:${String(Math.floor(remaining / 1000) % 60).padStart(2,"0")}`;

  if (!isFirebaseConfigured) return <section className="workshop-shell glass"><h2>Quản lý xưởng may</h2><p>Firebase chưa được cấu hình. Hãy khai báo các biến NEXT_PUBLIC_FIREBASE_* trước khi dùng tính năng đa xưởng.</p></section>;

  return <section className="workshop-shell">
    <header className="workshop-heading glass"><div className="workshop-icon"><Factory /></div><div><div className="eyebrow">Q-DCOM · WORKSHOP OPERATIONS</div><h1>Quản lý sản lượng xưởng</h1><p>PO, sản lượng và phụ phí được phân vùng theo mã xưởng.</p></div><button className="secondary-btn" type="button" onClick={() => void refresh()} disabled={!principal || busy}><RefreshCw size={15} /> Làm mới</button></header>
    {!uid ? <section className="workshop-card glass"><h2>Đăng nhập Google</h2><p>Cần tài khoản Google đã xác thực để tham gia xưởng và phân quyền theo thành viên Firebase.</p><button className="primary-btn" type="button" disabled={busy} onClick={() => { setBusy(true); void signInWithGooglePopup().then(({user}) => { setUid(user.uid); setSignedInName(user.displayName ?? user.email ?? ""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại.")).finally(() => setBusy(false)); }}>Đăng nhập Google</button></section>
    : !principal ? <div className="workshop-setup-grid">
      <form className="workshop-card glass" onSubmit={(event) => { event.preventDefault(); void connectTenant(); }}><h2>Tham gia xưởng</h2><p>Nhập mã xưởng và mã thẻ nhân viên đã được quản lý đăng ký. Thẻ được đối chiếu với UID Google để không thể dùng mã thẻ đơn lẻ giả mạo tài khoản.</p><label>Mã xưởng<input value={tenantIdInput} onChange={(event) => setTenantIdInput(event.target.value)} required /></label><label>Mã thẻ nhân viên<input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} required /></label><button className="primary-btn" disabled={busy || !tenantIdInput.trim()}>Kết nối xưởng</button></form>
      <form className="workshop-card glass" onSubmit={(event) => void makeTenant(event)}><h2>Tạo xưởng mới</h2><p>Người tạo được gán vai trò Admin đầu tiên.</p><label>Tên xưởng<input value={tenantName} onChange={(event) => setTenantName(event.target.value)} required maxLength={120} /></label><label>Mã thẻ quản lý<input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} required maxLength={64} /></label><button className="primary-btn" disabled={busy || !tenantName.trim()}>Tạo xưởng</button></form>
    </div> : <>
      <div className="workshop-tenant-strip glass"><span><strong>{principal.role === "admin" ? "QUẢN LÝ / ADMIN" : "CÔNG NHÂN / WORKER"}</strong><small>Mã xưởng: {principal.tenantId}</small></span><button className="quiet-btn" type="button" onClick={() => { setPrincipal(null); setActiveTenantId("local-default"); setOrders([]); setEntries([]); setExtras([]); setMembers([]); setEarnings(null); }}>Đổi xưởng</button><button className="quiet-btn" type="button" onClick={() => { void signOutFirebaseUser().then(() => { setPrincipal(null); setUid(""); setActiveTenantId("local-default"); }); }}>Đăng xuất Google</button></div>
      {principal.role === "admin" ? <>
        <div className="workshop-stat-grid"><div className="workshop-stat glass"><span>Đơn hàng PO</span><strong>{orders.length}</strong></div><div className="workshop-stat glass"><span>Chờ duyệt sản lượng</span><strong>{entries.filter((item) => item.status === "pending").length}</strong></div><div className="workshop-stat glass"><span>Chờ duyệt phụ phí</span><strong>{extras.length}</strong></div><div className="workshop-stat glass"><span>Thành viên xưởng</span><strong>{members.length}</strong></div></div>
        <div className="workshop-grid">
          <form className="workshop-card glass" onSubmit={(event) => void saveOrder(event)}><h2>{editingOrderId ? "Sửa đơn hàng PO" : "Tạo đơn hàng PO"}</h2><div className="workshop-fields"><label>Mã PO<input value={poCode} onChange={(event) => setPoCode(event.target.value)} required /></label><label>Tên sản phẩm<input value={productName} onChange={(event) => setProductName(event.target.value)} required /></label><label>Màu sắc<input value={color} onChange={(event) => setColor(event.target.value)} /></label><label>Số lượng tổng<input type="number" min="1" step="1" value={totalQuantity} onChange={(event) => setTotalQuantity(event.target.value)} required /></label><label>Ngày nhập kho<input type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} required /></label><label>Hạn xuất hàng<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required /></label><label>Công đoạn (nhiều công đoạn ngăn cách bằng dấu phẩy)<input value={operationName} onChange={(event) => setOperationName(event.target.value)} placeholder="May thân, ráp cổ, hoàn thiện" required /></label><label>Đơn giá tương ứng (VNĐ, cùng thứ tự)<input type="text" inputMode="decimal" value={unitRate} onChange={(event) => setUnitRate(event.target.value)} placeholder="2500, 1200, 800" required /></label></div><div className="workshop-actions"><button className="primary-btn" disabled={busy}><Plus size={15} /> {editingOrderId ? "Lưu thay đổi" : "Thêm PO"}</button>{editingOrderId && <button className="secondary-btn" type="button" onClick={() => { setEditingOrderId(""); setPoCode(""); setProductName(""); setColor(""); setOperationName(""); }}>Hủy sửa</button>}</div></form>
          <section className="workshop-card glass"><h2>Đơn hàng & hạn xuất</h2>{orders.map((order) => { const days = (Date.parse(order.dueAt) - Date.parse(today())) / 86400000; const urgent = days <= 3; return <article className={`workshop-list-row ${urgent ? "urgent" : ""}`} key={order.id}><div><strong>{order.poCode} · {order.productName}</strong><small>{order.color || "Chưa có màu"} · {order.totalQuantity.toLocaleString("vi-VN")} sản phẩm</small><small>Nhập: {order.receivedAt} · Hạn: {order.dueAt}</small>{urgent && <em><AlertTriangle size={13} /> {days < 0 ? "Đã trễ hạn xuất hàng" : "Sắp đến hạn xuất hàng"}</em>}</div><div className="workshop-actions"><button className="quiet-btn" type="button" onClick={() => editOrder(order)}>Sửa</button><button className="quiet-btn danger" type="button" onClick={() => { if (window.confirm(`Xóa PO ${order.poCode}?`)) void deleteWorkshopPurchaseOrder(principal, order.id).then(refresh).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể xóa PO.")); }}>Xóa</button></div></article>; })}{!orders.length && <p className="workshop-muted">Chưa có PO. Hãy tạo đơn hàng đầu tiên.</p>}</section>
          <section className="workshop-card glass"><h2>Duyệt sản lượng</h2>{entries.filter((item) => item.status === "pending").map((entry) => <article className="workshop-list-row" key={entry.id}><div><strong>{entry.workerName} · {entry.quantity} sản phẩm</strong><small>{entry.purchaseOrderId} · {entry.operationName} · {entry.workDate}</small></div><div className="workshop-actions"><button className="primary-btn" type="button" disabled={busy} onClick={() => void reviewEntry(entry.id,true)}>Duyệt</button><button className="quiet-btn danger" type="button" disabled={busy} onClick={() => void reviewEntry(entry.id,false)}>Từ chối</button></div></article>)}{!entries.some((item) => item.status === "pending") && <p className="workshop-muted">Không có báo cáo chờ duyệt.</p>}</section>
          <section className="workshop-card glass"><h2>Duyệt phụ phí cá nhân</h2>{extras.map((extra) => <article className="workshop-list-row" key={extra.id}><div><strong>{extra.description} · {money(extra.amount)}</strong><small>{extra.workerUid} · {extra.category} · {extra.workDate}</small></div><div className="workshop-actions"><button className="primary-btn" type="button" disabled={busy} onClick={() => void reviewExtra(extra.id,true)}>Duyệt</button><button className="quiet-btn danger" type="button" disabled={busy} onClick={() => void reviewExtra(extra.id,false)}>Từ chối</button></div></article>)}{!extras.length && <p className="workshop-muted">Không có phụ phí chờ duyệt.</p>}<p className="workshop-privacy"><ShieldCheck size={14} /> Admin chỉ xem khoản phụ phí đang chờ duyệt, không xem ví hoặc tổng thu nhập cá nhân.</p></section>
          <section className="workshop-card glass"><h2>Cấu hình nhắc nộp sản lượng</h2><p>Nhắc công nhân cập nhật theo chu kỳ 1–3 giờ.</p><div className="workshop-inline"><select value={intervalHours} onChange={(event) => setIntervalHours(event.target.value)}><option value="1">Mỗi 1 giờ</option><option value="2">Mỗi 2 giờ</option><option value="3">Mỗi 3 giờ</option></select><button className="primary-btn" type="button" disabled={busy} onClick={() => { if (principal) void saveWorkshopSettings(principal,Number(intervalHours)).then(refresh).then(() => setNotice("Đã lưu giờ nhắc nộp sản lượng.")).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể lưu cấu hình.")); }}>Lưu cấu hình</button></div></section>
          <section className="workshop-card glass"><h2><UserPlus size={17} /> Thêm công nhân</h2><p>Nhập UID Firebase của công nhân. Không dùng mã thẻ đơn thuần làm bằng chứng xác thực.</p><form className="workshop-fields" onSubmit={(event) => void addWorker(event)}><label>Firebase UID<input value={workerUid} onChange={(event) => setWorkerUid(event.target.value)} required /></label><label>Họ tên<input value={workerName} onChange={(event) => setWorkerName(event.target.value)} required /></label><label>Mã thẻ nhân viên<input value={workerCode} onChange={(event) => setWorkerCode(event.target.value)} required /></label><button className="primary-btn" disabled={busy}>Thêm thành viên</button></form></section>
        </div>
        <section className="workshop-card glass"><div className="workshop-section-heading"><h2>Bảng xếp hạng năng suất</h2><select value={rankingPeriod} onChange={(event) => setRankingPeriod(event.target.value)} aria-label="Kỳ xếp hạng"><option value="day">Hôm nay</option><option value="week">Tuần này</option><option value="month">Tháng này</option><option value="quarter">Quý này</option><option value="year">Năm nay</option></select></div><p className="workshop-muted">Xếp theo sản lượng đã duyệt. Cảnh báo đỏ là mức thấp hơn 50% trung bình của kỳ; không hiển thị tiền công.</p>{ranking.map((item,index) => { const low = index > 0 && averageQuantity > 0 && item.quantity < averageQuantity * 0.5; return <div className={`workshop-rank rank-${index===0?"gold":low?"red":index<3?"silver":"normal"}`} key={item.id}><span className="workshop-rank-medal">{index===0?"🥇":index===1?"🥈":index===2?"🥉":index+1}</span><span><strong>{item.name}</strong><small>{low ? "CẦN CHÚ Ý · dưới 50% trung bình" : item.id}</small></span><b>{item.quantity.toLocaleString("vi-VN")} sản phẩm</b></div>; })}{!ranking.length && <p className="workshop-muted">Chưa có dữ liệu năng suất được duyệt trong kỳ này.</p>}</section>
      </> : <>
        <div className="workshop-stat-grid"><div className="workshop-stat glass"><span>Sản lượng đã duyệt</span><strong>{(earnings?.approvedQuantity ?? 0).toLocaleString("vi-VN")}</strong></div><div className="workshop-stat glass"><span>Ví thu nhập cá nhân</span><strong>{money(earnings?.approvedEarnings ?? 0)}</strong></div><div className="workshop-stat glass"><span>Đơn hàng đang có</span><strong>{orders.length}</strong></div></div>
        <div className="workshop-grid"><form className="workshop-card glass" onSubmit={(event) => void submitProduction(event)}><h2>Nhập sản lượng hôm nay</h2><label>Đơn hàng / PO<select value={selectedOrderId} onChange={(event) => { setSelectedOrderId(event.target.value); const order = orders.find((item) => item.id === event.target.value); setSelectedOperationId(order?.operations?.[0]?.operationId ?? ""); }} required><option value="">Chọn PO</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.poCode} · {order.productName}</option>)}</select></label><label>Công đoạn<select value={selectedOperationId} onChange={(event) => setSelectedOperationId(event.target.value)} required><option value="">Chọn công đoạn</option>{(orders.find((item) => item.id === selectedOrderId)?.operations ?? []).map((operation) => <option key={operation.operationId} value={operation.operationId}>{operation.operationName}</option>)}</select></label><label>+ Thêm công đoạn phát sinh<input value={customOperationName} onChange={(event) => setCustomOperationName(event.target.value)} placeholder="Nhập tên công đoạn phát sinh" /><button className="secondary-btn" type="button" disabled={!customOperationName.trim()} onClick={() => setSelectedOperationId(operationId(customOperationName))}>Dùng công đoạn phát sinh</button></label><label>Số lượng hoàn thành<input type="number" min="1" step="1" value={productionQuantity} onChange={(event) => setProductionQuantity(event.target.value)} required /></label><label>Ngày làm<input type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} required /></label><button className="primary-btn" disabled={busy || !orders.length}>Gửi sản lượng chờ duyệt</button></form>
          <form className="workshop-card glass" onSubmit={(event) => void submitExtra(event)}><h2>Thu nhập bổ sung / phụ phí</h2><label>Loại khoản<select value={extraCategory} onChange={(event) => setExtraCategory(event.target.value as WorkerExtra["category"])}><option value="overtime">Trợ cấp tăng ca</option><option value="productivity_bonus">Thưởng năng suất</option><option value="commission">Hoa hồng</option><option value="other">Khác</option></select></label><label>Nội dung<input value={extraDescription} onChange={(event) => setExtraDescription(event.target.value)} required maxLength={300} /></label><label>Số tiền đề nghị (VNĐ)<input type="number" min="0" step="1" value={extraAmount} onChange={(event) => setExtraAmount(event.target.value)} required /></label><button className="primary-btn" disabled={busy}>Gửi phụ phí chờ duyệt</button><p className="workshop-muted">Khoản khai báo chỉ cộng vào ví sau khi được duyệt.</p></form>
          <section className="workshop-card glass"><h2><Clock3 size={17} /> Nhắc nhở nộp sản lượng</h2><div className="workshop-countdown">{countdown}</div><p>Chu kỳ nhắc: {settings?.submissionIntervalHours ?? 2} giờ. Đồng hồ tính từ lượt gửi gần nhất.</p><h3>Lịch sử gửi gần đây</h3>{entries.slice(0,8).map((entry) => <div className="workshop-history" key={entry.id}><span>{entry.workDate} · {entry.quantity} sản phẩm · {entry.operationName}</span><b className={`status-${entry.status}`}>{statusLabel(entry.status)}</b></div>)}{extras.slice(0,5).map((extra) => <div className="workshop-history" key={extra.id}><span>{extra.workDate} · {extra.description}</span><b className={`status-${extra.status}`}>{statusLabel(extra.status)}</b></div>)}</section>
          <section className="workshop-card glass"><h2><Wallet size={17} /> Ví thu nhập riêng tư</h2><p>Chỉ tài khoản của bạn đọc được dữ liệu này. Admin không có quyền đọc tài liệu ví trên Firestore.</p><div className="workshop-wallet-total">{money(earnings?.approvedEarnings ?? 0)}</div><p>{(earnings?.approvedQuantity ?? 0).toLocaleString("vi-VN")} sản phẩm đã duyệt</p><div className="workshop-section-heading"><h3>Tổng hợp theo kỳ</h3><select value={walletPeriod} onChange={(event) => setWalletPeriod(event.target.value)} aria-label="Kỳ thu nhập"><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm</option></select></div>{(earnings?.periods ?? []).filter((period) => String(period.period) === walletPeriod).slice(0,20).map((period,index) => <div className="workshop-history" key={String(period.period)+"-"+String(period.periodKey)+"-"+index}><span>{String(period.period)} · {String(period.periodKey)} · {Number(period.approvedQuantity ?? 0)} sản phẩm</span><b>{money(Number(period.approvedEarnings ?? 0))}</b></div>)}{!(earnings?.periods ?? []).some((period) => String(period.period) === walletPeriod) && <p className="workshop-muted">Chưa có dữ liệu thu nhập được duyệt cho kỳ này.</p>}</section>
        </div>
      </>}
      <section className="workshop-card glass workshop-chat-card"><h2><MessageCircle size={17} /> Cộng đồng xưởng · chỉ thành viên cùng tenant</h2><p>Tin nhắn được lưu dưới mã xưởng hiện tại; tài khoản ngoài xưởng không đọc được.</p><div className="workshop-chat-messages">{chatMessages.map((message) => <article className={`workshop-chat-message ${message.senderId === principal.uid ? "mine" : ""}`} key={message.id}><strong>{message.senderName || message.senderId}</strong><p>{message.text}</p><small>{dateTime(message.createdAt) ? new Date(dateTime(message.createdAt)).toLocaleString("vi-VN") : "vừa gửi"}</small></article>)}{!chatMessages.length && <p className="workshop-muted">Chưa có tin nhắn trong phòng chat xưởng.</p>}</div><form className="workshop-chat-compose" onSubmit={(event) => void sendChat(event)}><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} maxLength={4000} placeholder="Nhắn tin cho thành viên cùng xưởng…" aria-label="Tin nhắn xưởng" /><button className="primary-btn" disabled={busy || !chatDraft.trim()}>Gửi</button></form></section>
    </>}
    {notice && <p className="workshop-notice" role="status">{notice}</p>}{error && <p className="workshop-error" role="alert">{error}</p>}
  </section>;
}
