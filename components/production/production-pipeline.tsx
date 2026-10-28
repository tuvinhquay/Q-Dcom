"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, ClipboardCheck, PackageCheck, Scissors, Shirt, Sparkles } from "lucide-react";
import type { ProductionEntry, ProductionStage } from "@/lib/services/productionService";

const standardStages = [
  { id: "cutting", name: "Cắt", icon: Scissors },
  { id: "sewing", name: "May", icon: Shirt },
  { id: "inspection", name: "KCS", icon: ClipboardCheck },
  { id: "packing", name: "Đóng gói", icon: PackageCheck },
] as const;
const threshold = 50;

function readQueues(key: string, stages: ProductionStage[]) {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, value]) =>
      stages.some((stage) => stage.id === id) && Number.isSafeInteger(value) && Number(value) >= 0));
  } catch {
    return {};
  }
}

/** Shared live flow view, keyed by tenant/order; queue levels are private to this browser. */
export function ProductionPipeline({
  groupId, orderId, stages, entries, target,
  onError,
}: {
  groupId: string;
  orderId: string;
  stages: ProductionStage[];
  entries: ProductionEntry[];
  target: number;
  onError: (message: string) => void;
}) {
  const activeStages = stages.filter((stage) => stage.orderId === orderId && stage.active);
  const pipelineStages = activeStages.length
    ? activeStages.map((stage) => ({ id: stage.id, name: stage.name, source: stage }))
    : standardStages.map((stage) => ({ id: stage.id, name: stage.name, source: null }));
  const storageKey = `qdcom.production-pipeline.${groupId}.${orderId || "overview"}`;
  const [queues, setQueues] = useState<Record<string, number>>(() => readQueues(storageKey, activeStages));
  const today = new Date();
  const todayKey = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const approvedToday = entries.filter((entry) => entry.status === "approved" && entry.date === todayKey && (!orderId || entry.orderId === orderId));
  const completed = approvedToday.reduce((sum, entry) => sum + entry.quantity, 0);
  const progress = Math.min(100, Math.round((completed / Math.max(1, target)) * 100));

  function updateQueue(id: string, value: string) {
    const next = { ...queues, [id]: Math.max(0, Number(value) || 0) };
    setQueues(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (cause) {
      onError(cause instanceof Error ? `Không lưu được hàng chờ trên thiết bị: ${cause.message}` : "Không lưu được hàng chờ trên thiết bị.");
    }
  }

  return (
    <section className="production-glass production-pipeline-card" aria-label="Luồng công đoạn của nhóm xưởng">
      <header className="production-pipeline-header">
        <div><span className="production-kicker"><Sparkles /> LUỒNG SẢN XUẤT</span><h2>Tiến độ công đoạn</h2><p>Số lượng chỉ gồm sản lượng đã duyệt trong nhóm xưởng; hàng chờ được lưu riêng trên thiết bị.</p></div>
        <div className="production-pipeline-progress"><div className="production-ring" style={{ "--progress": `${progress}%` } as CSSProperties}><div className="production-ring-center"><strong>{progress}%</strong><span>định mức</span></div></div><span>{completed.toLocaleString("vi-VN")} / {target.toLocaleString("vi-VN")} sp</span></div>
      </header>
      <div className="production-pipeline-track">
        {pipelineStages.map((stage, index) => {
          const Icon = activeStages.find((item) => item.id === stage.id)?.name.toLowerCase().includes("kcs")
            ? ClipboardCheck
            : activeStages.find((item) => item.id === stage.id)?.name.toLowerCase().includes("đóng")
              ? PackageCheck
              : activeStages.find((item) => item.id === stage.id)?.name.toLowerCase().includes("cắt")
                ? Scissors
                : Shirt;
          const queue = queues[stage.id] ?? 0;
          const count = approvedToday.filter((entry) => stage.source
            ? entry.stageId === stage.id
            : entry.stageName.toLowerCase().includes(stage.name.toLowerCase())).reduce((sum, entry) => sum + entry.quantity, 0);
          return <div className="production-stage-slot" key={stage.id}>
            <article className={`production-stage-card ${queue >= threshold ? "bottleneck" : ""}`}>
              <div className="production-stage-top"><span className="production-stage-icon"><Icon /></span><span className="production-stage-step">0{index + 1}</span></div>
              <strong>{stage.name}</strong><span className="production-stage-output">{count.toLocaleString("vi-VN")} <small>đã duyệt hôm nay</small></span>
              <label className="production-queue-control"><span>Hàng chờ</span><span className="production-queue-input"><input type="number" min="0" step="1" aria-label={`Hàng chờ công đoạn ${stage.name}`} value={queue} onChange={(event) => updateQueue(stage.id, event.target.value)} /><small>sp</small></span></label>
              {queue >= threshold && <span className="production-bottleneck-alert"><i /> Nút thắt</span>}
            </article>
            {index < pipelineStages.length - 1 && <div className="production-stage-connector" aria-hidden="true"><span className="production-particle" /><ArrowRight /></div>}
          </div>;
        })}
      </div>
      <div className="production-pipeline-legend"><span><i className="production-legend-flow" />Sản lượng đã duyệt</span><span><i className="production-legend-warning" />Nút thắt từ {threshold} sản phẩm đang chờ</span></div>
    </section>
  );
}
