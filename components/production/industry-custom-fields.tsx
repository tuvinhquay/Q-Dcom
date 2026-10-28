"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, Plus, UsersRound } from "lucide-react";
import { ProductionEntryForm } from "@/components/production/production-entry-form";
import { ProductionIncomeWallet } from "@/components/production/production-income-wallet";
import { ProductionOwnerConsole } from "@/components/production/production-owner-console";
import { ProductionPipeline } from "@/components/production/production-pipeline";
import {
  createProductionGroup,
  getProductionJoinRequest,
  setProductionApprovalRequired,
  submitProductionEntry,
  submitProductionJoinRequest,
  watchProductionEntries,
  watchProductionFields,
  watchProductionGroups,
  watchProductionJoinRequests,
  watchProductionOrders,
  watchProductionStages,
  type ProductionCustomField,
  type ProductionEntry,
  type ProductionGroup,
  type ProductionJoinRequest,
  type ProductionOrder,
  type ProductionStage,
} from "@/lib/services/productionService";

/** Tenant-scoped production module: every cloud subscription is bound to one authorized workspace. */
export function IndustryCustomFields({ uid, displayName }: { uid: string | null; displayName: string }) {
  const [groups, setGroups] = useState<ProductionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [fields, setFields] = useState<ProductionCustomField[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [joinRequests, setJoinRequests] = useState<ProductionJoinRequest[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinStatus, setJoinStatus] = useState<ProductionJoinRequest | null>(null);
  const [groupName, setGroupName] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [selectedPipelineOrderId, setSelectedPipelineOrderId] = useState("");
  const [showWorkspaceActions, setShowWorkspaceActions] = useState(false);
  const [dailyTarget, setDailyTarget] = useState("1000");
  const [correctionEntry, setCorrectionEntry] = useState<ProductionEntry | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!uid) return;
    return watchProductionGroups(uid, (nextGroups) => {
      setGroups(nextGroups);
      setSelectedGroupId((current) => current && nextGroups.some((group) => group.id === current)
        ? current
        : nextGroups[0]?.id ?? "");
      setLoading(false);
      setError("");
    }, (cause) => {
      setLoading(false);
      setError(cause.message || "Không thể tải nhóm xưởng.");
    });
  }, [uid]);

  const group = groups.find((item) => item.id === selectedGroupId) ?? null;
  const isGroupOwner = Boolean(group && uid && group.ownerId === uid);
  const isManager = Boolean(group && uid && (group.ownerId === uid || group.managerIds.includes(uid)));

  useEffect(() => {
    if (!group || !uid) return;
    const onFailure = (cause: Error) => setError(cause.message || "Không thể tải dữ liệu nhóm xưởng.");
    const unsubscribers = [
      watchProductionOrders(group.id, setOrders, onFailure),
      watchProductionStages(group.id, setStages, onFailure),
      watchProductionFields(group.id, setFields, onFailure),
      watchProductionEntries(group.id, uid, isManager, setEntries, onFailure),
    ];
    if (isGroupOwner) unsubscribers.push(watchProductionJoinRequests(group.id, setJoinRequests, onFailure));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [group, isGroupOwner, isManager, uid]);

  const activeOrders = orders.filter((order) => order.active);
  const pipelineOrderId = activeOrders.some((order) => order.id === selectedPipelineOrderId)
    ? selectedPipelineOrderId
    : activeOrders[0]?.id ?? "";
  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await createProductionGroup(groupName, uid, approvalRequired);
      setGroupName("");
      setSelectedGroupId(created.id);
      setShowWorkspaceActions(false);
      setNotice(created.localOnly
        ? `Firebase chưa cấp quyền tạo nhóm. “${created.name}” chỉ được lưu trên thiết bị này, chưa thể chia sẻ với thành viên khác. Mã nội bộ: ${created.id}`
        : `Đã tạo nhóm xưởng “${created.name}”. Mã tham gia: ${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo nhóm xưởng.");
    } finally {
      setBusy(false);
    }
  }

  async function requestToJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await submitProductionJoinRequest(joinCode, uid, displayName);
      const request = await getProductionJoinRequest(joinCode.trim(), uid);
      setJoinStatus(request);
      setShowWorkspaceActions(false);
      setNotice("Đã gửi yêu cầu tham gia. Bạn sẽ thấy nhóm xưởng sau khi quản lý duyệt.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi yêu cầu tham gia nhóm xưởng.");
    } finally {
      setBusy(false);
    }
  }

  async function checkJoinStatus() {
    if (!uid || !joinCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const request = await getProductionJoinRequest(joinCode.trim(), uid);
      setJoinStatus(request);
      if (!request) setNotice("Không tìm thấy yêu cầu tham gia bằng mã nhóm này.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể kiểm tra yêu cầu tham gia.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEntry(values: {
    order: ProductionOrder;
    stage: ProductionStage;
    date: string;
    quantity: number;
    customValues: Record<string, string>;
    correctionEntry?: ProductionEntry;
  }) {
    if (!group || !uid) throw new Error("Cần chọn nhóm xưởng hợp lệ.");
    const savedLocally = await submitProductionEntry({
      group,
      workerId: uid,
      workerName: displayName,
      ...values,
    });
    setCorrectionEntry(null);
    setNotice(savedLocally
    ? "Firebase chưa cấp quyền ghi; sản lượng chỉ lưu trên thiết bị này, chưa chia sẻ hoặc đồng bộ. Hãy nhờ quản lý kiểm tra quyền trước khi xem là đã nộp."
      : group.approvalRequired
        ? "Đã gửi sản lượng, đang chờ quản lý nhóm xưởng duyệt."
        : "Đã ghi nhận sản lượng vào ví cá nhân và báo cáo nhóm.");
    setError("");
  }

  async function changeApprovalMode(required: boolean) {
    if (!group || !isManager) return;
    setBusy(true);
    setError("");
    try {
      await setProductionApprovalRequired(group.id, required);
      setNotice(required ? "Đã bật chế độ quản lý duyệt sản lượng." : "Đã tắt kiểm duyệt; lượt nhập mới sẽ được ghi nhận trực tiếp.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thay đổi chế độ xét duyệt.");
    } finally {
      setBusy(false);
    }
  }

  if (!uid) {
    return <section className="production-glass production-auth-gate"><Building2 /><h2>Đăng nhập Google để dùng nhóm xưởng</h2><p>Nhóm xưởng, đơn giá và thu nhập được chia sẻ an toàn theo tài khoản Firebase. Tài khoản ID trên thiết bị không có quyền truy cập dữ liệu dùng chung.</p></section>;
  }

  return (
    <section className="production-page">
      <header className="production-page-heading"><div><span className="production-kicker">Q-DCOM · QUẢN LÝ XƯỞNG MAY</span><h1>Sản lượng & ví thu nhập</h1><p>Cùng quản lý sản xuất, phân quyền theo vai trò và giữ riêng dữ liệu của từng nhóm xưởng.</p></div><span className="production-cloud-badge"><i /> Dữ liệu riêng theo nhóm</span></header>
      {error && <p className="production-global-message error" role="alert">{error}</p>}
      {notice && <p className={`production-global-message${notice.includes("chỉ lưu trên thiết bị") ? " local-only" : ""}`} role="status">{notice}</p>}

      <section className="production-glass production-workspace-bar">
        <label><span><Building2 /> Nhóm xưởng hiện tại</span><select value={selectedGroupId} onChange={(event) => {
          setSelectedGroupId(event.target.value);
          setOrders([]);
          setStages([]);
          setFields([]);
          setEntries([]);
          setJoinRequests([]);
          setCorrectionEntry(null);
          setError("");
          setNotice("");
        }} disabled={!groups.length}>
          {!groups.length && <option value="">Chưa tham gia nhóm xưởng</option>}
          {groups.map((item) => <option key={item.id} value={item.id}>{item.name}{item.ownerId === uid ? " · Chủ nhóm" : item.managerIds.includes(uid) ? " · Quản lý" : ""}</option>)}
        </select></label>
        {group && <div className="production-workspace-meta"><span><UsersRound /> {group.memberIds.length} thành viên</span><span>{group.approvalRequired ? "Có kiểm duyệt" : "Ghi nhận trực tiếp"}</span>{group.localOnly && <strong className="production-local-only-badge">Chỉ lưu trên thiết bị · chưa đồng bộ</strong>}<small>Mã: {group.id}</small></div>}
        {!!groups.length && <button type="button" className="production-secondary-button" onClick={() => setShowWorkspaceActions((visible) => !visible)}>{showWorkspaceActions ? "Đóng" : "Tham gia / tạo nhóm xưởng"}</button>}
      </section>

      {loading ? <div className="production-glass production-inline-empty">Đang tải nhóm xưởng theo quyền tài khoản…</div> : null}

      {!loading && (!groups.length || showWorkspaceActions) && (
        <div className="production-workspace-onboarding">
          <section className="production-glass production-onboarding-card"><span className="production-onboarding-icon"><Plus /></span><h2>Tạo nhóm xưởng</h2><p>Tạo nhóm riêng cho xưởng/công ty. Người tạo là quản lý nhóm, phụ trách cấu hình, duyệt thành viên, bảng giá và sản lượng.</p>
            <form onSubmit={(event) => void createWorkspace(event)}><label><span>Tên nhóm / xưởng</span><input required maxLength={100} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Ví dụ: Xưởng May An Phú" /></label><label className="production-check-label"><input type="checkbox" checked={approvalRequired} onChange={(event) => setApprovalRequired(event.target.checked)} /><span>Bật duyệt sản lượng mặc định</span></label><button className="production-submit-button" disabled={busy}><Plus /> Tạo nhóm xưởng</button></form>
          </section>
          <section className="production-glass production-onboarding-card"><span className="production-onboarding-icon"><UsersRound /></span><h2>Tham gia nhóm xưởng</h2><p>Nhập mã do quản lý nhóm cung cấp. Bạn chỉ xem được đơn hàng, công đoạn và thu nhập trong nhóm đã duyệt bạn tham gia.</p>
            <form onSubmit={(event) => void requestToJoin(event)}><label><span>Mã nhóm xưởng</span><input required value={joinCode} onChange={(event) => { setJoinCode(event.target.value); setJoinStatus(null); }} placeholder="Dán mã nhóm xưởng" /></label><div className="production-onboarding-actions"><button className="production-submit-button" disabled={busy}>Gửi yêu cầu</button><button type="button" className="production-secondary-button" disabled={busy || !joinCode.trim()} onClick={() => void checkJoinStatus()}>Kiểm tra trạng thái</button></div>{joinStatus && <span className={`production-status-badge ${joinStatus.status === "approved" ? "approved" : joinStatus.status === "rejected" ? "revision_requested" : "pending"}`}>Yêu cầu: {joinStatus.status === "pending" ? "Chờ duyệt" : joinStatus.status === "approved" ? "Đã duyệt" : "Bị từ chối"}</span>}</form>
          </section>
        </div>
      )}

      {group && (
        <>
          {isManager && <div className="production-owner-mode"><span><strong>{isGroupOwner ? "Quản lý nhóm xưởng" : "Quản lý được phân quyền"}</strong><small>{isGroupOwner ? "Toàn quyền cấu hình, phân vai trò, duyệt thành viên và sản lượng." : "Được cấu hình danh mục, đơn giá và duyệt sản lượng trong nhóm này."}</small></span><button type="button" className={`production-reminder-toggle ${group.approvalRequired ? "on" : ""}`} role="switch" aria-checked={group.approvalRequired} aria-label="Bật duyệt sản lượng" disabled={busy} onClick={() => void changeApprovalMode(!group.approvalRequired)} /></div>}
          {isManager && <ProductionOwnerConsole key={group.id} uid={uid} group={group} orders={orders} stages={stages} fields={fields} entries={entries} joinRequests={joinRequests} isGroupOwner={isGroupOwner} onError={(message) => {
            if (message && message.startsWith("Đã ")) { setNotice(message); setError(""); }
            else { setError(message); if (!message) setNotice(""); }
          }} />}
          <ProductionPipeline key={`${group.id}:${pipelineOrderId || "overview"}`} groupId={group.id} orderId={pipelineOrderId} stages={stages} entries={entries} target={Math.max(1, Number(dailyTarget) || 1)} onError={setError} />
          <section className="production-glass production-target-setting">
            <label><span>Đơn hàng theo dõi</span><select value={pipelineOrderId} onChange={(event) => setSelectedPipelineOrderId(event.target.value)} disabled={!activeOrders.length}>{!activeOrders.length && <option value="">Chưa có đơn hàng hoạt động</option>}{activeOrders.map((order) => <option key={order.id} value={order.id}>{order.code} · PO {order.po}</option>)}</select></label>
            <label><span>Định mức sản phẩm / ngày của sơ đồ</span><input type="number" min="1" step="1" value={dailyTarget} onChange={(event) => setDailyTarget(event.target.value)} /></label>
          </section>
          <ProductionEntryForm key={`${group.id}:${correctionEntry?.id ?? "new"}`} orders={orders} stages={stages} fields={fields} correctionEntry={correctionEntry} onSubmit={submitEntry} onCancelCorrection={() => setCorrectionEntry(null)} />
          <ProductionIncomeWallet key={`${group.id}:${uid}`} uid={uid} entries={entries.filter((entry) => entry.workerId === uid)} exchangeRateVndPerUsd={group.exchangeRateVndPerUsd} goldPriceVndPerChi={group.goldPriceVndPerChi} goldType={group.goldType} onEditCorrection={setCorrectionEntry} />
        </>
      )}
    </section>
  );
}
