"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import {
  approveProductionEntries,
  deleteProductionField,
  deleteProductionOrder,
  deleteProductionStage,
  requestProductionCorrection,
  resolveProductionJoinRequest,
  saveProductionField,
  saveProductionCurrencyRates,
  saveProductionOrder,
  saveProductionStage,
  setProductionManager,
  type ProductionCustomField,
  type ProductionEntry,
  type ProductionGroup,
  type ProductionJoinRequest,
  type ProductionOrder,
  type ProductionStage,
} from "@/lib/services/productionService";

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("vi-VN");
const typeLabels = { text: "Văn bản", number: "Số", date: "Ngày" } as const;

/** Owner/manager console for pricing, production catalog and approval workflows. */
export function ProductionOwnerConsole({
  uid, group, orders, stages, fields, entries, joinRequests, isGroupOwner, onError,
}: {
  uid: string;
  group: ProductionGroup;
  orders: ProductionOrder[];
  stages: ProductionStage[];
  fields: ProductionCustomField[];
  entries: ProductionEntry[];
  joinRequests: ProductionJoinRequest[];
  isGroupOwner: boolean;
  onError: (message: string) => void;
}) {
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [orderId, setOrderId] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [po, setPo] = useState("");
  const [color, setColor] = useState("");
  const [productName, setProductName] = useState("");
  const [stageEditId, setStageEditId] = useState("");
  const [stageOrderId, setStageOrderId] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageLine, setStageLine] = useState("");
  const [stagePrice, setStagePrice] = useState("");
  const [fieldEditId, setFieldEditId] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<ProductionCustomField["type"]>("text");
  const [fieldUnit, setFieldUnit] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(group.exchangeRateVndPerUsd ? String(group.exchangeRateVndPerUsd) : "");
  const [goldPrice, setGoldPrice] = useState(group.goldPriceVndPerChi ? String(group.goldPriceVndPerChi) : "");
  const [goldType, setGoldType] = useState<"SJC" | "Vàng nhẫn">(group.goldType ?? "SJC");
  const [busy, setBusy] = useState(false);
  const pendingEntries = entries.filter((entry) => entry.status === "pending");
  const approvedEntries = entries.filter((entry) => entry.status === "approved");
  const approvedQuantity = approvedEntries.reduce((total, entry) => total + BigInt(entry.quantity), BigInt(0));
  const approvedAmount = approvedEntries.reduce((total, entry) => total + BigInt(entry.amountVnd), BigInt(0));

  async function perform(action: () => Promise<void>, success?: string) {
    setBusy(true);
    onError("");
    try {
      await action();
      if (success) onError(success);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Không thể lưu thay đổi quản lý.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      await saveProductionOrder(group.id, {
        code: orderCode, po, color, productName, active: true,
      }, orderId || undefined);
      setOrderId("");
      setOrderCode("");
      setPo("");
      setColor("");
      setProductName("");
    }, "Đã lưu đơn hàng.");
  }

  function editOrder(order: ProductionOrder) {
    setOrderId(order.id);
    setOrderCode(order.code);
    setPo(order.po);
    setColor(order.color);
    setProductName(order.productName);
  }

  function resetOrderForm() {
    setOrderId("");
    setOrderCode("");
    setPo("");
    setColor("");
    setProductName("");
  }

  async function submitStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      await saveProductionStage(group.id, {
        orderId: stageOrderId,
        name: stageName,
        line: stageLine,
        unitPriceVnd: Number(stagePrice),
        active: true,
      }, stageEditId || undefined);
      resetStageForm();
    }, "Đã lưu công đoạn và đơn giá.");
  }

  function editStage(stage: ProductionStage) {
    setStageEditId(stage.id);
    setStageOrderId(stage.orderId);
    setStageName(stage.name);
    setStageLine(stage.line);
    setStagePrice(String(stage.unitPriceVnd));
  }

  function resetStageForm() {
    setStageEditId("");
    setStageOrderId("");
    setStageName("");
    setStageLine("");
    setStagePrice("");
  }

  async function submitField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      await saveProductionField(group.id, {
        label: fieldLabel,
        type: fieldType,
        unit: fieldUnit,
        required: fieldRequired,
      }, fieldEditId || undefined);
      resetFieldForm();
    }, "Đã lưu thông tin bổ sung của nhóm xưởng.");
  }

  function resetFieldForm() {
    setFieldEditId("");
    setFieldLabel("");
    setFieldType("text");
    setFieldUnit("");
    setFieldRequired(false);
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(group.id);
      onError("Đã sao chép mã tham gia nhóm xưởng.");
    } catch {
      onError("Trình duyệt không cho phép sao chép. Mã nhóm: " + group.id);
    }
  }

  return (
    <div className="production-owner-console">
      {isGroupOwner && <section className="production-glass production-admin-card">
        <header className="production-admin-header"><div><span className="production-kicker">ĐƠN GIÁ & TỶ GIÁ QUY ĐỔI</span><h2>Đơn giá & Tỷ giá quy đổi</h2><p>Không tự lấy tỷ giá bên ngoài. Mức quản lý lưu sẽ được dùng cho ví đến lần cập nhật tiếp theo.</p></div></header>
        <form className="production-admin-form" onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            await saveProductionCurrencyRates(group.id, uid, Number(exchangeRate), Number(goldPrice), goldType);
          }, "Đã cập nhật đơn giá và tỷ giá quy đổi cho nhóm xưởng.");
        }}>
          <label><span>1 USD quy đổi (VND)</span><input required type="number" min="1" max="1000000" step="1" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} placeholder="Nhập tỷ giá đã thống nhất" /></label>
          <label><span>Giá vàng mỗi chỉ (VND)</span><input required type="number" min="1" max="10000000000" step="1" value={goldPrice} onChange={(event) => setGoldPrice(event.target.value)} placeholder="Nhập giá quy đổi" /></label>
          <label><span>Loại vàng</span><select value={goldType} onChange={(event) => setGoldType(event.target.value as "SJC" | "Vàng nhẫn")}><option value="SJC">Vàng miếng SJC</option><option value="Vàng nhẫn">Vàng nhẫn</option></select></label>
          <div className="production-admin-form-actions"><button className="production-submit-button" disabled={busy || !exchangeRate || !goldPrice}><Check /> Lưu đơn giá & tỷ giá</button></div>
        </form>
      </section>}

      <section className="production-glass production-admin-card">
        <header className="production-admin-header"><div><span className="production-kicker">QUẢN LÝ NHÓM XƯỞNG</span><h2>Cấu hình nhóm xưởng</h2><p>Danh mục, đơn giá và sản lượng chỉ được chia sẻ trong nhóm xưởng này.</p></div><UsersRound /></header>
        <div className="production-workspace-details">
          <div><span>Tên nhóm</span><strong>{group.name}</strong></div>
          <div><span>Mã tham gia</span><strong className="production-mono">{group.id}</strong></div>
          <div><span>Thành viên</span><strong>{group.memberIds.length}</strong></div>
          <button type="button" className="production-ghost-button" onClick={() => void copyInviteCode()}><Copy /> Sao chép mã</button>
        </div>
        <div className="production-role-list"><h3>Vai trò thành viên</h3>{group.memberIds.map((memberId) => {
          const isOwner = memberId === group.ownerId;
          const isManager = group.managerIds.includes(memberId);
          return <article key={memberId}><div><strong>{memberId === uid ? "Bạn" : "Thành viên"} · {memberId}</strong><small>{isOwner ? "Quản lý nhóm · toàn quyền" : isManager ? "Quản lý · cấu hình và xét duyệt sản lượng" : "Công nhân · nhập và xem sản lượng cá nhân"}</small></div>{isGroupOwner && !isOwner && <button type="button" className="production-ghost-button" disabled={busy} onClick={() => void perform(() => setProductionManager(group.id, uid, memberId, !isManager), isManager ? "Đã gỡ quyền quản lý." : "Đã phân quyền quản lý.")}>{isManager ? "Gỡ quyền" : "Cấp quản lý"}</button>}</article>;
        })}</div>
        {isGroupOwner && <div className="production-join-requests"><h3>Yêu cầu tham gia <span>{joinRequests.length}</span></h3>
          {joinRequests.length ? joinRequests.map((request) => <article key={request.id}><div><strong>{request.displayName}</strong><small>UID: {request.userId}</small></div><button type="button" className="production-admin-approve" disabled={busy} onClick={() => void perform(async () => {
            await resolveProductionJoinRequest(group.id, request.userId, true);
          }, "Đã duyệt thành viên.")}><Check /> Duyệt</button><button type="button" className="production-ghost-button" disabled={busy} onClick={() => void perform(async () => {
            await resolveProductionJoinRequest(group.id, request.userId, false);
          })}>Từ chối</button></article>) : <p>Chưa có yêu cầu tham gia chờ xử lý.</p>}
        </div>}
      </section>

      <section className="production-glass production-admin-card">
        <header className="production-admin-header"><div><span className="production-kicker">XÉT DUYỆT SẢN LƯỢNG THỢ</span><h2>Xét duyệt sản lượng thợ</h2><p>Lượt đang chờ chưa được cộng vào ví thu nhập cá nhân hoặc báo cáo xưởng.</p></div><span className="production-status-badge pending">{pendingEntries.length} chờ duyệt</span></header>
        <div className="production-shop-summary">
          <article><span>Sản phẩm đã duyệt</span><strong>{number.format(approvedQuantity)}</strong></article>
          <article><span>Thu nhập xưởng đã duyệt</span><strong>{vnd.format(approvedAmount)}</strong></article>
          <article><span>Chờ kiểm duyệt</span><strong>{number.format(pendingEntries.length)}</strong></article>
        </div>
        {pendingEntries.length ? <>
          <div className="production-bulk-actions"><label><input type="checkbox" checked={selectedEntryIds.length === pendingEntries.length} onChange={(event) => setSelectedEntryIds(event.target.checked ? pendingEntries.map((entry) => entry.id) : [])} /> Chọn tất cả</label><button type="button" className="production-admin-approve" disabled={busy || !selectedEntryIds.length} onClick={() => void perform(async () => {
            await approveProductionEntries(group.id, selectedEntryIds, uid);
            setSelectedEntryIds([]);
          }, `Đã duyệt ${selectedEntryIds.length} lượt nhập.`)}><Check /> Duyệt đã chọn ({selectedEntryIds.length})</button></div>
          <div className="production-approval-list">{pendingEntries.map((entry) => <article key={entry.id} className="production-approval-row"><input type="checkbox" checked={selectedEntryIds.includes(entry.id)} aria-label={`Chọn lượt sản lượng của ${entry.workerName}`} onChange={(event) => setSelectedEntryIds((current) => event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} /><div><strong>{entry.workerName} · {entry.orderCode}</strong><span>{entry.stageName} · {entry.line} · {entry.date} · {entry.quantity.toLocaleString("vi-VN")} sp</span><small>{vnd.format(entry.unitPriceVnd)} / sp = <b>{vnd.format(entry.amountVnd)}</b></small></div><button type="button" className="production-admin-approve" disabled={busy} onClick={() => void perform(() => approveProductionEntries(group.id, [entry.id], uid), "Đã duyệt sản lượng.")}><Check /> Duyệt</button><button type="button" className="production-ghost-button" disabled={busy} onClick={() => {
            const note = window.prompt("Nhập lý do cần công nhân sửa lượt sản lượng:");
            if (note?.trim()) void perform(() => requestProductionCorrection(group.id, entry.id, uid, note), "Đã gửi yêu cầu chỉnh sửa.");
          }}>Yêu cầu sửa</button></article>)}</div>
        </> : <div className="production-inline-empty">Không có lượt sản lượng chờ duyệt.</div>}
      </section>

      <section className="production-glass production-admin-card">
        <header className="production-admin-header"><div><span className="production-kicker">DANH MỤC ĐƠN HÀNG</span><h2>Danh mục đơn hàng</h2><p>Thông tin đơn hàng giúp công nhân nhập sản lượng nhanh hoặc quét mã QR.</p></div></header>
        <form className="production-admin-form" onSubmit={(event) => void submitOrder(event)}>
          <label><span>Mã đơn hàng</span><input required value={orderCode} onChange={(event) => setOrderCode(event.target.value)} /></label><label><span>Mã PO</span><input required value={po} onChange={(event) => setPo(event.target.value)} /></label><label><span>Màu sắc</span><input required value={color} onChange={(event) => setColor(event.target.value)} /></label><label><span>Tên sản phẩm</span><input required value={productName} onChange={(event) => setProductName(event.target.value)} /></label>
          <div className="production-admin-form-actions"><button type="submit" className="production-submit-button" disabled={busy}>{orderId ? <Check /> : <Plus />}{orderId ? "Cập nhật đơn" : "Thêm đơn hàng"}</button>{orderId && <button type="button" className="production-ghost-button" onClick={resetOrderForm}>Hủy sửa</button>}</div>
        </form>
        <div className="production-admin-catalog">{orders.map((order) => <article key={order.id}><div><strong>{order.code} <span>· PO {order.po} · {order.color}</span></strong><small>{order.productName} · {order.active ? "Đang nhận" : "Đã tạm dừng"}</small></div><button type="button" className="production-ghost-button" onClick={() => editOrder(order)}><Pencil /></button><button type="button" className="production-ghost-button" onClick={() => void perform(() => saveProductionOrder(group.id, { ...order, active: !order.active }, order.id))}>{order.active ? "Tạm dừng" : "Kích hoạt"}</button><button type="button" className="production-ghost-button danger" onClick={() => void perform(() => deleteProductionOrder(group.id, order.id))}><Trash2 /></button></article>)}</div>
      </section>

      <section className="production-glass production-admin-card">
        <header className="production-admin-header"><div><span className="production-kicker">CÔNG ĐOẠN & BẢNG GIÁ</span><h2>Công đoạn & Bảng giá</h2><p>Đơn giá tính bằng VNĐ/sản phẩm; hệ thống xác minh thành tiền = sản lượng × đơn giá.</p></div></header>
        <form className="production-admin-form" onSubmit={(event) => void submitStage(event)}>
          <label><span>Đơn hàng</span><select required value={stageOrderId} onChange={(event) => setStageOrderId(event.target.value)}><option value="">Chọn đơn hàng</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.code} · PO {order.po}</option>)}</select></label><label><span>Tên công đoạn</span><input required value={stageName} onChange={(event) => setStageName(event.target.value)} placeholder="Cắt / May thân / KCS" /></label><label><span>Chuyền</span><input required value={stageLine} onChange={(event) => setStageLine(event.target.value)} placeholder="Chuyền 01" /></label><label><span>Đơn giá (VNĐ/sp)</span><input required type="number" min="0" max="1000000000" step="1" value={stagePrice} onChange={(event) => setStagePrice(event.target.value)} /></label>
          <div className="production-admin-form-actions"><button type="submit" className="production-submit-button" disabled={busy || !orders.length}>{stageEditId ? <Check /> : <Plus />}{stageEditId ? "Cập nhật giá" : "Thêm công đoạn"}</button>{stageEditId && <button type="button" className="production-ghost-button" onClick={resetStageForm}>Hủy sửa</button>}</div>
        </form>
        <div className="production-admin-catalog">{stages.map((stage) => <article key={stage.id}><div><strong>{stage.name} <span>· {stage.line}</span></strong><small>{orders.find((order) => order.id === stage.orderId)?.code ?? "Đơn đã xóa"} · {stage.active ? "Đang hoạt động" : "Đã tạm dừng"}</small></div><b>{vnd.format(stage.unitPriceVnd)}</b><button type="button" className="production-ghost-button" onClick={() => editStage(stage)}><Pencil /></button><button type="button" className="production-ghost-button" onClick={() => void perform(() => saveProductionStage(group.id, { ...stage, active: !stage.active }, stage.id))}>{stage.active ? "Tạm dừng" : "Kích hoạt"}</button><button type="button" className="production-ghost-button danger" onClick={() => void perform(() => deleteProductionStage(group.id, stage.id))}><Trash2 /></button></article>)}</div>
      </section>

      <section className="production-glass production-admin-card">
        <header className="production-admin-header"><div><span className="production-kicker">THÔNG TIN BỔ SUNG</span><h2>Thông tin bổ sung</h2><p>Công nhân sẽ điền các mục này khi nhập sản lượng trong nhóm xưởng.</p></div></header>
        <form className="production-admin-form" onSubmit={(event) => void submitField(event)}>
          <label><span>Tên trường</span><input required value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Kích cỡ / Mã lô…" /></label><label><span>Kiểu dữ liệu</span><select value={fieldType} onChange={(event) => setFieldType(event.target.value as ProductionCustomField["type"])}>{Object.entries(typeLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span>Đơn vị (tùy chọn)</span><input value={fieldUnit} onChange={(event) => setFieldUnit(event.target.value)} /></label><label className="production-required-field"><input type="checkbox" checked={fieldRequired} onChange={(event) => setFieldRequired(event.target.checked)} /> Bắt buộc nhập</label>
          <div className="production-admin-form-actions"><button type="submit" className="production-submit-button" disabled={busy}>{fieldEditId ? <Check /> : <Plus />}{fieldEditId ? "Cập nhật trường" : "Thêm trường"}</button>{fieldEditId && <button type="button" className="production-ghost-button" onClick={resetFieldForm}>Hủy sửa</button>}</div>
        </form>
        <div className="production-admin-catalog">{fields.map((field) => <article key={field.id}><div><strong>{field.label} <span>· {typeLabels[field.type]}</span></strong><small>{field.unit || "Không có đơn vị"} · {field.required ? "Bắt buộc" : "Tùy chọn"}</small></div><button type="button" className="production-ghost-button" onClick={() => { setFieldEditId(field.id); setFieldLabel(field.label); setFieldType(field.type); setFieldUnit(field.unit); setFieldRequired(field.required); }}><Pencil /></button><button type="button" className="production-ghost-button danger" onClick={() => void perform(() => deleteProductionField(group.id, field.id))}><Trash2 /></button></article>)}</div>
      </section>
    </div>
  );
}
