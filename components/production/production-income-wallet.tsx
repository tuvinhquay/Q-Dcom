"use client";

import { useMemo, useState } from "react";
import { Bell, BellOff, CalendarDays, CircleCheck, Clock3, Wallet } from "lucide-react";
import type { ProductionEntry, ProductionStatus } from "@/lib/services/productionService";

type Period = "day" | "week" | "month" | "quarter" | "year";
type StatusFilter = "all" | ProductionStatus;
type Bucket = { key: string; label: string; quantity: bigint; amount: bigint };
const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);
const periodOptions: Array<{ id: Period; label: string }> = [
  { id: "day", label: "Ngày" },
  { id: "week", label: "Tuần" },
  { id: "month", label: "Tháng" },
  { id: "quarter", label: "Quý" },
  { id: "year", label: "Năm" },
];
const statusLabels: Record<ProductionStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  revision_requested: "Yêu cầu sửa",
};
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("vi-VN");
function dateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatRatio(amountVnd: bigint, rate: number, suffix: string, prefix = "") {
  const scaled = amountVnd * HUNDRED / BigInt(rate);
  const whole = scaled / HUNDRED;
  const fraction = String(scaled % HUNDRED).padStart(2, "0");
  return `${prefix}${new Intl.NumberFormat("en-US").format(whole)}.${fraction}${suffix}`;
}

function dateInPeriod(value: string, period: Period, now: Date): boolean {
  const date = parseDate(value);
  if (period === "day") return value === dateKey(now);
  if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return date >= start && date < end;
  }
  if (period === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (period === "quarter") {
    return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  }
  return date.getFullYear() === now.getFullYear();
}

function makeBuckets(period: Period, now: Date): Bucket[] {
  if (period === "day") return [{ key: dateKey(now), label: "Hôm nay", quantity: ZERO, amount: ZERO }];
  if (period === "week") {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
      return { key: dateKey(date), label: new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date), quantity: ZERO, amount: ZERO };
    });
  }
  if (period === "month") {
    const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil(count / 7);
    return Array.from({ length: weeks }, (_, index) => ({
      key: `week-${index}`,
      label: `Tuần ${index + 1}`,
      quantity: ZERO,
      amount: ZERO,
    }));
  }
  const firstMonth = period === "quarter" ? Math.floor(now.getMonth() / 3) * 3 : 0;
  const count = period === "quarter" ? 3 : 12;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), firstMonth + index, 1);
    return { key: `month-${date.getMonth()}`, label: new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(date), quantity: ZERO, amount: ZERO };
  });
}

function bucketKey(entry: ProductionEntry, period: Period): string {
  if (period === "day" || period === "week") return entry.date;
  const date = parseDate(entry.date);
  if (period === "month") return `week-${Math.floor((date.getDate() - 1) / 7)}`;
  return `month-${date.getMonth()}`;
}

function readReminder(uid: string) {
  if (typeof window === "undefined") return { enabled: false, hours: 1 };
  try {
    const stored = window.localStorage.getItem(`qdcom.production-reminder.${uid}`);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    if (!parsed || typeof parsed !== "object") return { enabled: false, hours: 1 };
    const value = parsed as { enabled?: unknown; hours?: unknown };
    return {
      enabled: value.enabled === true,
      hours: value.hours === 2 || value.hours === 3 ? value.hours : 1,
    };
  } catch {
    return { enabled: false, hours: 1 };
  }
}

/** Worker wallet: status transparency, approved-only earnings, grouped chart and reminders. */
export function ProductionIncomeWallet({
  uid, entries, exchangeRateVndPerUsd, goldPriceVndPerChi, goldType, onEditCorrection,
}: {
  uid: string;
  entries: ProductionEntry[];
  exchangeRateVndPerUsd?: number;
  goldPriceVndPerChi?: number;
  goldType?: "SJC" | "Vàng nhẫn";
  onEditCorrection: (entry: ProductionEntry) => void;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const reminderKey = uid;
  const reminder = useMemo(() => readReminder(reminderKey), [reminderKey]);
  const [reminderEnabled, setReminderEnabled] = useState(reminder.enabled);
  const [reminderHours, setReminderHours] = useState(reminder.hours);
  const [reminderError, setReminderError] = useState("");
  const now = new Date();
  const usdRate = Number.isSafeInteger(exchangeRateVndPerUsd) && Number(exchangeRateVndPerUsd) > 0
    ? Number(exchangeRateVndPerUsd)
    : null;
  const goldRate = Number.isSafeInteger(goldPriceVndPerChi) && Number(goldPriceVndPerChi) > 0
    ? Number(goldPriceVndPerChi)
    : null;
  const approved = entries.filter((entry) => entry.status === "approved" && dateInPeriod(entry.date, period, now));
  const totalQuantity = approved.reduce((sum, entry) => sum + BigInt(entry.quantity), ZERO);
  const totalAmount = approved.reduce((sum, entry) => sum + BigInt(entry.amountVnd), ZERO);
  const monthAmount = entries
    .filter((entry) => entry.status === "approved" && dateInPeriod(entry.date, "month", now))
    .reduce((sum, entry) => sum + BigInt(entry.amountVnd), ZERO);
  const goldProgress = goldRate
    ? Math.min(100, Number((monthAmount * HUNDRED) / BigInt(goldRate)))
    : 0;
  const buckets = makeBuckets(period, now);
  const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  entries.filter((entry) => entry.status === "approved" && dateInPeriod(entry.date, period, now))
    .forEach((entry) => {
      const bucket = bucketsByKey.get(bucketKey(entry, period));
      if (bucket) {
        bucket.quantity += BigInt(entry.quantity);
        bucket.amount += BigInt(entry.amountVnd);
      }
    });
  const maxAmount = buckets.reduce((max, bucket) => bucket.amount > max ? bucket.amount : max, ONE);
  const filteredEntries = statusFilter === "all" ? entries : entries.filter((entry) => entry.status === statusFilter);
  const pendingCount = entries.filter((entry) => entry.status === "pending").length;

  function persistReminder(enabled: boolean, hours: number, lastNotifiedAt: number) {
    try {
      window.localStorage.setItem(`qdcom.production-reminder.${reminderKey}`, JSON.stringify({
        enabled,
        hours,
        lastNotifiedAt,
      }));
      return "";
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Không lưu được cấu hình nhắc nộp.";
    }
  }

  async function toggleReminder() {
    setReminderError("");
    if (reminderEnabled) {
      setReminderError(persistReminder(false, reminderHours, Date.now()));
      setReminderEnabled(false);
      return;
    }
    if (typeof Notification === "undefined") {
      setReminderError("Trình duyệt này không hỗ trợ thông báo. Hãy bật thông báo trong trình duyệt tương thích.");
      return;
    }
    try {
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setReminderError("Bạn chưa cấp quyền thông báo cho Q-Dcom.");
        return;
      }
      const saveError = persistReminder(true, reminderHours, Date.now());
      if (saveError) {
        setReminderError(saveError);
        return;
      }
      setReminderEnabled(true);
    } catch (cause) {
      setReminderError(cause instanceof Error ? cause.message : "Không thể bật quyền thông báo.");
    }
  }

  return (
    <section className="production-worker-wallet">
      <div className="production-wallet-heading"><div><span className="production-kicker">VÍ THU NHẬP CÁ NHÂN</span><h2>Ví thu nhập & sản lượng</h2><p>Thu nhập chỉ tính trên các lượt đã được duyệt trong nhóm xưởng này.</p></div><span className="production-approved-note"><CircleCheck /> Đã đối soát</span></div>
      <div className="production-period-tabs" role="group" aria-label="Lọc thu nhập theo thời gian">
        {periodOptions.map((option) => <button type="button" key={option.id} className={period === option.id ? "active" : ""} onClick={() => setPeriod(option.id)}>{option.label}</button>)}
      </div>
      <div className="production-wallet-stats">
        <article className="production-wallet-stat"><span><PackageIcon /> Sản lượng đã duyệt</span><strong>{number.format(totalQuantity)} <small>sản phẩm</small></strong><p>{periodOptions.find((option) => option.id === period)?.label} hiện tại</p></article>
        <article className="production-wallet-stat income"><span><Wallet /> Thu nhập tích lũy</span><strong>{vnd.format(totalAmount)}</strong><p>Σ (sản lượng × đơn giá đã chốt)</p></article>
        <article className="production-wallet-stat pending"><span><Clock3 /> Đang chờ duyệt</span><strong>{number.format(pendingCount)} <small>lượt</small></strong><p>Hiển thị riêng, chưa cộng vào thu nhập</p></article>
      </div>
      <div className="production-asset-cards" aria-label="Giá trị thu nhập quy đổi">
        <article className="production-asset-card usd"><span>Đô la Mỹ · Tỷ giá quy đổi</span><strong>{usdRate ? formatRatio(totalAmount, usdRate, "", "$") : "Chưa cấu hình"}</strong><small>{usdRate ? `1 USD = ${number.format(usdRate)} VND` : "Quản lý nhóm xưởng cần thiết lập tỷ giá"}</small></article>
        <article className="production-asset-card gold"><span>{goldType ?? "Vàng"} · Giá mỗi chỉ</span><strong>{goldRate ? `${formatRatio(totalAmount, goldRate, "")} chỉ` : "Chưa cấu hình"}</strong><small>{goldRate ? `${vnd.format(goldRate)} / chỉ` : "Quản lý nhóm xưởng cần thiết lập giá vàng"}</small></article>
      </div>
      <section className="production-gold-goal" aria-label="Mục tiêu tích lũy vàng trong tháng">
        <div><strong>Mục tiêu tích lũy vàng tháng này</strong><span>{goldRate ? `${goldProgress}% · ${formatRatio(monthAmount, goldRate, "")} / 1 chỉ` : "Cần cấu hình giá vàng nhóm xưởng"}</span></div>
        <div className="production-gold-progress"><i style={{ width: `${goldProgress}%` }} /></div>
        <p>{goldRate ? (goldProgress >= 100 ? "Tuyệt vời! Bạn đã đạt mục tiêu tháng." : "Mỗi sản phẩm hoàn thành đưa bạn gần hơn tới mục tiêu.") : "Quản lý nhóm xưởng có thể đặt mức giá quy đổi trong phần cài đặt."}</p>
      </section>
      <section className="production-income-chart">
        <header><div><h3>Tiến độ thu nhập</h3><p>Chỉ gồm sản lượng đã được duyệt</p></div><span>{vnd.format(totalAmount)}</span></header>
        <div className={`production-chart-bars ${period}`} role="img" aria-label="Biểu đồ thu nhập theo thời gian">
          {buckets.map((bucket) => {
            const height = bucket.amount === ZERO ? 3 : Math.max(8, Number((bucket.amount * HUNDRED) / maxAmount));
            return <div className="production-chart-column" key={bucket.key} title={`${bucket.label}: ${vnd.format(bucket.amount)} · ${number.format(bucket.quantity)} sản phẩm`}>
              <div className="production-chart-value" style={{ height: `${height}%` }} />
              <span>{bucket.label}</span>
            </div>;
          })}
        </div>
      </section>
      <section className="production-submission-list">
        <header><div><h3>Kho sản lượng cá nhân</h3><p>{filteredEntries.length} lượt nhập · bao gồm trạng thái kiểm duyệt</p></div><label><CalendarDays /><select aria-label="Lọc trạng thái sản lượng" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">Tất cả trạng thái</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="revision_requested">Yêu cầu sửa</option></select></label></header>
        {filteredEntries.length ? <div className="production-entry-history">
          {filteredEntries.map((entry) => <article className="production-entry-history-row" key={entry.id}>
            <div className="production-history-main"><strong>{entry.orderCode} · {entry.stageName}</strong><span>PO {entry.po} · {entry.color} · {entry.line}</span><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString("vi-VN")}</small></div>
            <div className="production-history-amount"><strong>{number.format(entry.quantity)} sp</strong><span>{vnd.format(entry.amountVnd)}</span></div>
            <span className={`production-status-badge ${entry.status}`}>{statusLabels[entry.status]}</span>
            {entry.localOnly && <p className="production-local-entry-note">Chỉ lưu trên thiết bị này · chưa được gửi để duyệt</p>}
            {entry.reviewNote && <p className="production-review-note">{entry.reviewNote}</p>}
            {entry.status === "revision_requested" && <button type="button" className="production-ghost-button" onClick={() => onEditCorrection(entry)}>Sửa và gửi lại</button>}
          </article>)}
        </div> : <div className="production-inline-empty">Chưa có lượt nhập ở trạng thái này.</div>}
      </section>
      <section className="production-reminder-card">
        <div><span className="production-reminder-icon">{reminderEnabled ? <Bell /> : <BellOff />}</span><div><strong>Nhắc nộp sản lượng</strong><p>Thông báo cục bộ khi bạn đang mở Q-Dcom.</p></div></div>
        <label><span>Mỗi</span><select value={reminderHours} onChange={(event) => {
          const hours = Number(event.target.value) as 1 | 2 | 3;
          setReminderHours(hours);
          setReminderError(persistReminder(reminderEnabled, hours, Date.now()));
        }}><option value={1}>1 giờ</option><option value={2}>2 giờ</option><option value={3}>3 giờ</option></select></label>
        <button type="button" className={`production-reminder-toggle ${reminderEnabled ? "on" : ""}`} role="switch" aria-checked={reminderEnabled} aria-label="Bật nhắc nộp sản lượng" onClick={() => void toggleReminder()} />
      </section>
      {reminderError && <p className="production-form-error" role="alert">{reminderError}</p>}
    </section>
  );
}

function PackageIcon() {
  return <span className="production-stat-package" aria-hidden="true">Q</span>;
}
