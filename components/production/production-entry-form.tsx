"use client";

import { useState, type FormEvent } from "react";
import { QrCode, Send, X } from "lucide-react";
import { QrCameraScanner } from "@/components/qr-camera-scanner";
import type {
  ProductionCustomField,
  ProductionEntry,
  ProductionOrder,
  ProductionStage,
} from "@/lib/services/productionService";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

type ProductionEntryFormProps = {
  orders: ProductionOrder[];
  stages: ProductionStage[];
  fields: ProductionCustomField[];
  correctionEntry: ProductionEntry | null;
  onSubmit: (values: {
    order: ProductionOrder;
    stage: ProductionStage;
    date: string;
    quantity: number;
    customValues: Record<string, string>;
    correctionEntry?: ProductionEntry;
  }) => Promise<void>;
  onCancelCorrection: () => void;
};

/** Worker entry form: resolves the group-configured rate and previews exact VND pay. */
export function ProductionEntryForm({
  orders, stages, fields, correctionEntry, onSubmit, onCancelCorrection,
}: ProductionEntryFormProps) {
  const activeOrders = orders.filter((order) => order.active);
  const [orderId, setOrderId] = useState(correctionEntry?.orderId ?? activeOrders[0]?.id ?? "");
  const selectedOrder = activeOrders.find((order) => order.id === orderId) ?? activeOrders[0];
  const activeStages = stages.filter((stage) => stage.active && stage.orderId === selectedOrder?.id);
  const [stageId, setStageId] = useState(correctionEntry?.stageId ?? activeStages[0]?.id ?? "");
  const selectedStage = activeStages.find((stage) => stage.id === stageId) ?? activeStages[0];
  const [date, setDate] = useState(correctionEntry?.date ?? localDate());
  const [quantity, setQuantity] = useState(correctionEntry ? String(correctionEntry.quantity) : "");
  const [customValues, setCustomValues] = useState<Record<string, string>>(correctionEntry?.customValues ?? {});
  const [scanOpen, setScanOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = selectedStage && Number.isSafeInteger(Number(quantity))
    ? Number(quantity || 0) * selectedStage.unitPriceVnd
    : 0;

  function scanOrder(value: string) {
    const token = value.trim();
    const order = activeOrders.find((item) =>
      item.id === token || item.code.toLocaleLowerCase("vi") === token.toLocaleLowerCase("vi") ||
      item.po.toLocaleLowerCase("vi") === token.toLocaleLowerCase("vi"));
    setScanOpen(false);
    if (!order) {
      setError("Mã QR không khớp mã đơn hàng hoặc PO đang hoạt động trong nhóm.");
      return;
    }
    setOrderId(order.id);
    const firstStage = stages.find((stage) => stage.orderId === order.id && stage.active);
    setStageId(firstStage?.id ?? "");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder || !selectedStage) {
      setError("Nhóm chưa có đơn hàng và công đoạn đang hoạt động.");
      return;
    }
    const parsedQuantity = Number(quantity);
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
      setError("Nhập sản lượng là số nguyên lớn hơn 0.");
      return;
    }
    for (const field of fields.filter((item) => item.required)) {
      if (!customValues[field.id]?.trim()) {
        setError(`Vui lòng nhập trường bắt buộc: ${field.label}.`);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        order: selectedOrder,
        stage: selectedStage,
        date,
        quantity: parsedQuantity,
        customValues,
        ...(correctionEntry ? { correctionEntry } : {}),
      });
      setQuantity("");
      setCustomValues({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi sản lượng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="production-glass production-worker-card">
      <div className="production-card-heading">
        <div><span className="production-kicker">CÔNG NHÂN · NHẬP LIỆU</span><h2>{correctionEntry ? "Cập nhật lượt nhập" : "Nhập sản lượng hàng ngày"}</h2><p>Chọn đơn hàng và công đoạn để tự động áp dụng đúng đơn giá của nhóm xưởng.</p></div>
        {correctionEntry && <button type="button" className="production-ghost-button" onClick={onCancelCorrection}><X /> Hủy sửa</button>}
      </div>
      {activeOrders.length === 0 ? (
        <div className="production-inline-empty">Nhóm chưa có đơn hàng đang hoạt động. Trưởng nhóm cần thiết lập đơn hàng và công đoạn trước.</div>
      ) : (
        <form className="production-entry-form" onSubmit={(event) => void submit(event)}>
          <label><span>Mã đơn hàng · PO · màu sắc</span><select value={selectedOrder?.id ?? ""} onChange={(event) => {
            setOrderId(event.target.value);
            setStageId("");
            setError("");
          }} required>
            {activeOrders.map((order) => <option value={order.id} key={order.id}>{order.code} · PO {order.po} · {order.color} · {order.productName}</option>)}
          </select></label>
          <button type="button" className="production-ghost-button production-scan-button" onClick={() => setScanOpen(true)}><QrCode /> Quét mã QR đơn hàng</button>
          <div className="production-entry-grid">
            <label><span>Công đoạn · chuyền</span><select value={selectedStage?.id ?? ""} onChange={(event) => { setStageId(event.target.value); setError(""); }} required>
              {activeStages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name} · {stage.line} · {money.format(stage.unitPriceVnd)}/sp</option>)}
            </select></label>
            <label><span>Ngày sản xuất</span><input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label><span>Sản lượng thực tế (Q)</span><input type="number" min="1" max="1000000" step="1" inputMode="numeric" required value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Nhập số lượng" /></label>
            {fields.map((field) => <label key={field.id}><span>{field.label}{field.required ? " *" : ""}{field.unit ? ` · ${field.unit}` : ""}</span><input type={field.type} required={field.required} value={customValues[field.id] ?? ""} onChange={(event) => setCustomValues((current) => ({ ...current, [field.id]: event.target.value }))} /></label>)}
          </div>
          <div className="production-amount-preview"><span>Đơn giá đã cấu hình: <strong>{money.format(selectedStage?.unitPriceVnd ?? 0)} / sản phẩm</strong></span><span>Tạm tính: <strong>{money.format(amount)}</strong></span></div>
          <button type="submit" className="production-submit-button" disabled={busy || !selectedStage}><Send />{busy ? "Đang gửi…" : "Gửi sản lượng"}</button>
          {error && <p className="production-form-error" role="alert">{error}</p>}
        </form>
      )}
      {scanOpen && <div className="production-scan-overlay"><section className="production-scan-dialog" role="dialog" aria-modal="true" aria-label="Quét mã đơn hàng"><header><strong>Quét mã đơn hàng / PO</strong><button type="button" aria-label="Đóng" onClick={() => setScanOpen(false)}><X /></button></header><p>Quét mã đơn hàng, mã PO hoặc mã nhận diện đơn hàng trong nhóm xưởng này.</p><QrCameraScanner onScan={scanOrder} onError={setError} /></section></div>}
    </section>
  );
}
