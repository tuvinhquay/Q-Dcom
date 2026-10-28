import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { qdcomDB, type LocalProductionRecord } from "@/lib/db/qdcomDB";
import { getFirebaseFirestore } from "@/lib/firebase";

export type ProductionStatus = "pending" | "approved" | "revision_requested";
export type ProductionFieldType = "text" | "number" | "date";

export interface ProductionGroup {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  managerIds: string[];
  approvalRequired: boolean;
  exchangeRateVndPerUsd?: number;
  goldPriceVndPerChi?: number;
  goldType?: "SJC" | "Vàng nhẫn";
  localOnly?: boolean;
}

export interface ProductionJoinRequest {
  id: string;
  userId: string;
  displayName: string;
  status: "pending" | "approved" | "rejected";
  requestedAt?: unknown;
}

export interface ProductionOrder {
  id: string;
  groupId: string;
  code: string;
  po: string;
  color: string;
  productName: string;
  active: boolean;
}

export interface ProductionStage {
  id: string;
  groupId: string;
  orderId: string;
  name: string;
  line: string;
  unitPriceVnd: number;
  active: boolean;
}

export interface ProductionCustomField {
  id: string;
  groupId: string;
  label: string;
  type: ProductionFieldType;
  unit: string;
  required: boolean;
}

export interface ProductionEntry {
  id: string;
  groupId: string;
  workerId: string;
  workerName: string;
  orderId: string;
  orderCode: string;
  po: string;
  color: string;
  stageId: string;
  stageName: string;
  line: string;
  date: string;
  quantity: number;
  unitPriceVnd: number;
  amountVnd: number;
  customValues: Record<string, string>;
  status: ProductionStatus;
  reviewNote: string;
  reviewedBy: string;
  createdAt?: unknown;
  localOnly?: boolean;
}

type Listener<T> = (items: T[]) => void;
type ErrorListener = (error: Error) => void;
const MAX_PRICE_VND = 1_000_000_000;
const MAX_QUANTITY = 1_000_000;
const localListeners = new Set<(uid: string, groupId: string) => void>();

function isPermissionDenied(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "code" in cause
    && (cause.code === "permission-denied" || cause.code === "firestore/permission-denied");
}

function notifyLocalProduction(uid: string, groupId: string) {
  localListeners.forEach((listener) => listener(uid, groupId));
}

async function localRows<T>(uid: string, groupId: string, kind: LocalProductionRecord["kind"]): Promise<T[]> {
  const rows = await qdcomDB.localProduction
    .where("[ownerUid+groupId+kind]")
    .equals([uid, groupId, kind])
    .toArray();
  return rows.map((row) => row.data as T);
}

async function findLocalGroup(groupId: string): Promise<ProductionGroup | null> {
  const row = await qdcomDB.localProduction
    .where("groupId")
    .equals(groupId)
    .and((item) => item.kind === "group")
    .first();
  return row ? row.data as unknown as ProductionGroup : null;
}

async function saveLocalProduction(
  uid: string,
  groupId: string,
  kind: LocalProductionRecord["kind"],
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await qdcomDB.localProduction.put({
    id: `${uid}:${groupId}:${kind}:${id}`,
    ownerUid: uid,
    groupId,
    kind,
    data,
    updatedAt: new Date().toISOString(),
  });
  notifyLocalProduction(uid, groupId);
}

function subscribeLocalProduction(uid: string, groupId: string, onChange: () => void): () => void {
  const listener = (ownerUid: string, changedGroupId: string) => {
    if (ownerUid === uid && changedGroupId === groupId) onChange();
  };
  localListeners.add(listener);
  return () => localListeners.delete(listener);
}

function db() {
  return getFirebaseFirestore();
}

function workspaceRef(groupId: string) {
  return doc(db(), "productionGroups", groupId);
}

function groupCollection(groupId: string, name: string) {
  return collection(db(), "productionGroups", groupId, name);
}

function subscribeCollection<T>(
  groupId: string,
  collectionName: string,
  onChange: Listener<T>,
  onError: ErrorListener,
  filters: ReturnType<typeof where>[] = [],
): Unsubscribe {
  return onSnapshot(query(groupCollection(groupId, collectionName), ...filters), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
  }, onError);
}

function requireText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} không được để trống và tối đa ${maxLength} ký tự.`);
  }
  return normalized;
}

function requireDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Ngày sản lượng không hợp lệ.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Ngày sản lượng không tồn tại.");
  }
  return value;
}

export function watchProductionGroups(uid: string, onChange: Listener<ProductionGroup>, onError: ErrorListener): Unsubscribe {
  let cloudGroups: ProductionGroup[] = [];
  const emitGroups = async (cloudGroups: ProductionGroup[]) => {
    const localGroups = await qdcomDB.localProduction
      .where("[ownerUid+kind]")
      .equals([uid, "group"])
      .toArray();
    onChange([
      ...cloudGroups,
      ...localGroups.map((row) => row.data as unknown as ProductionGroup),
    ]);
  };
  const unsubscribeCloud = onSnapshot(query(
    collection(db(), "productionGroups"),
    where("memberIds", "array-contains", uid),
    limit(100),
  ), (snapshot) => {
    cloudGroups = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ProductionGroup);
    void emitGroups(cloudGroups);
  }, (cause) => {
    if (!isPermissionDenied(cause)) onError(cause);
    cloudGroups = [];
    void emitGroups(cloudGroups);
  });
  const listener = (ownerUid: string, groupId: string) => {
    if (ownerUid === uid && groupId) void emitGroups(cloudGroups);
  };
  localListeners.add(listener);
  return () => {
    unsubscribeCloud();
    localListeners.delete(listener);
  };
}

export async function saveProductionCurrencyRates(
  groupId: string,
  uid: string,
  exchangeRateVndPerUsd: number,
  goldPriceVndPerChi: number,
  goldType: "SJC" | "Vàng nhẫn",
): Promise<void> {
  if (!Number.isSafeInteger(exchangeRateVndPerUsd) || exchangeRateVndPerUsd < 1 || exchangeRateVndPerUsd > 1_000_000) {
    throw new Error("Tỷ giá phải là số nguyên VND/USD hợp lệ.");
  }
  if (!Number.isSafeInteger(goldPriceVndPerChi) || goldPriceVndPerChi < 1 || goldPriceVndPerChi > 10_000_000_000) {
    throw new Error("Giá vàng phải là số nguyên VND/chỉ hợp lệ.");
  }
  const rates = { exchangeRateVndPerUsd, goldPriceVndPerChi, goldType };
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    if (localGroup.ownerId !== uid) throw new Error("Chỉ trưởng nhóm mới được thay đổi tỷ giá.");
    const updatedGroup = { ...localGroup, ...rates };
    await saveLocalProduction(uid, groupId, "group", groupId, updatedGroup);
    return;
  }
  await updateDoc(workspaceRef(groupId), rates);
}

export async function createProductionGroup(name: string, uid: string, approvalRequired: boolean): Promise<ProductionGroup> {
  const normalized = requireText(name, "Tên nhóm sản xuất", 100);
  const groupRef = doc(collection(db(), "productionGroups"));
  const group = {
    id: groupRef.id,
    name: normalized,
    ownerId: uid,
    memberIds: [uid],
    managerIds: [],
    approvalRequired,
  };
  try {
    await setDoc(groupRef, { ...group, createdAt: serverTimestamp() });
    return group;
  } catch (cause) {
    if (!isPermissionDenied(cause)) throw cause;
    const localGroup = { ...group, localOnly: true };
    await saveLocalProduction(uid, localGroup.id, "group", localGroup.id, localGroup);
    return localGroup;
  }
}

export async function setProductionManager(groupId: string, ownerId: string, memberId: string, enabled: boolean): Promise<void> {
  if (memberId === ownerId) throw new Error("Chủ nhóm đã có toàn quyền quản lý.");
  await runTransaction(db(), async (transaction) => {
    const reference = workspaceRef(groupId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Không tìm thấy workspace.");
    const group = snapshot.data() as Omit<ProductionGroup, "id">;
    if (group.ownerId !== ownerId) throw new Error("Chỉ chủ workspace mới có thể phân quyền quản lý.");
    if (!group.memberIds.includes(memberId)) throw new Error("Chỉ thành viên hiện tại mới được phân quyền.");
    const managerIds = Array.isArray(group.managerIds) ? group.managerIds : [];
    const nextManagerIds = enabled
      ? [...new Set([...managerIds, memberId])]
      : managerIds.filter((id) => id !== memberId);
    transaction.update(reference, { managerIds: nextManagerIds });
  });
}

export async function submitProductionJoinRequest(groupId: string, uid: string, displayName: string): Promise<void> {
  const normalizedGroupId = requireText(groupId, "Mã nhóm", 160);
  const requestRef = doc(db(), "productionGroups", normalizedGroupId, "joinRequests", uid);
  const existing = await getDoc(requestRef);
  if (existing.exists() && existing.data().status === "pending") {
    throw new Error("Yêu cầu tham gia nhóm này đang chờ duyệt.");
  }
  if (existing.exists() && existing.data().status === "approved") {
    throw new Error("Bạn đã là thành viên của nhóm này.");
  }
  const request = {
    userId: uid,
    displayName: requireText(displayName, "Tên hiển thị", 120),
    status: "pending",
    requestedAt: serverTimestamp(),
  };
  if (existing.exists()) await updateDoc(requestRef, request);
  else await setDoc(requestRef, request);
}

export async function getProductionJoinRequest(groupId: string, uid: string): Promise<ProductionJoinRequest | null> {
  const snapshot = await getDoc(doc(db(), "productionGroups", groupId, "joinRequests", uid));
  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() } as ProductionJoinRequest
    : null;
}

export async function resolveProductionJoinRequest(
  groupId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  const groupRef = workspaceRef(groupId);
  const requestRef = doc(db(), "productionGroups", groupId, "joinRequests", userId);
  await runTransaction(db(), async (transaction) => {
    const [groupSnapshot, requestSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(requestRef),
    ]);
    if (!groupSnapshot.exists() || !requestSnapshot.exists()) {
      throw new Error("Không tìm thấy nhóm sản xuất hoặc yêu cầu tham gia.");
    }
    const group = groupSnapshot.data() as Omit<ProductionGroup, "id">;
    const joinRequest = requestSnapshot.data() as ProductionJoinRequest;
    if (joinRequest.status !== "pending") throw new Error("Yêu cầu này đã được xử lý.");
    const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
    const nextMemberIds = approve && !memberIds.includes(userId) ? [...memberIds, userId] : memberIds;
    transaction.update(groupRef, { memberIds: nextMemberIds });
    transaction.update(requestRef, { status: approve ? "approved" : "rejected" });
  });
}

export function watchProductionJoinRequests(
  groupId: string,
  onChange: Listener<ProductionJoinRequest>,
  onError: ErrorListener,
): Unsubscribe {
  let disposed = false;
  let unsubscribeCloud: Unsubscribe | undefined;
  void findLocalGroup(groupId).then((localGroup) => {
    if (disposed) return;
    if (localGroup) {
      onChange([]);
      return;
    }
    unsubscribeCloud = subscribeCollection(
      groupId,
      "joinRequests",
      onChange,
      onError,
      [where("status", "==", "pending")],
    );
  }).catch(onError);
  return () => {
    disposed = true;
    unsubscribeCloud?.();
  };
}

export async function setProductionApprovalRequired(groupId: string, required: boolean): Promise<void> {
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    await saveLocalProduction(localGroup.ownerId, groupId, "group", groupId, {
      ...localGroup,
      approvalRequired: required,
    });
    return;
  }
  await updateDoc(workspaceRef(groupId), { approvalRequired: required });
}

export function watchProductionOrders(groupId: string, onChange: Listener<ProductionOrder>, onError: ErrorListener): Unsubscribe {
  return watchProductionCollection(groupId, "orders", "order", onChange, onError);
}

export function watchProductionStages(groupId: string, onChange: Listener<ProductionStage>, onError: ErrorListener): Unsubscribe {
  return watchProductionCollection(groupId, "stages", "stage", onChange, onError);
}

export function watchProductionFields(groupId: string, onChange: Listener<ProductionCustomField>, onError: ErrorListener): Unsubscribe {
  return watchProductionCollection(groupId, "customFields", "field", onChange, onError);
}

function watchProductionCollection<T>(
  groupId: string,
  collectionName: string,
  kind: "order" | "stage" | "field",
  onChange: Listener<T>,
  onError: ErrorListener,
): Unsubscribe {
  let disposed = false;
  let unsubscribeLocal: (() => void) | undefined;
  let unsubscribeCloud: Unsubscribe | undefined;
  void findLocalGroup(groupId).then((localGroup) => {
    if (disposed) return;
    if (localGroup) {
      const emit = () => void localRows<T>(localGroup.ownerId, groupId, kind).then(onChange).catch(onError);
      unsubscribeLocal = subscribeLocalProduction(localGroup.ownerId, groupId, emit);
      emit();
      return;
    }
    unsubscribeCloud = subscribeCollection<T>(groupId, collectionName, onChange, onError);
  }).catch(onError);
  return () => {
    disposed = true;
    unsubscribeLocal?.();
    unsubscribeCloud?.();
  };
}

export function watchProductionEntries(
  groupId: string,
  uid: string,
  canReviewGroup: boolean,
  onChange: Listener<ProductionEntry>,
  onError: ErrorListener,
): Unsubscribe {
  let disposed = false;
  const emitLocalEntries = async (cloudEntries: ProductionEntry[]) => {
    const localEntries = await localRows<ProductionEntry>(uid, groupId, "entry");
    if (!disposed) {
      const byId = new Map(cloudEntries.map((entry) => [entry.id, entry]));
      localEntries.forEach((entry) => byId.set(entry.id, entry));
      onChange([...byId.values()]);
    }
  };
  const refreshLocal = () => { void emitLocalEntries([]).catch(onError); };
  const unsubscribeLocal = subscribeLocalProduction(uid, groupId, refreshLocal);
  let unsubscribeCloud: Unsubscribe | undefined;
  void findLocalGroup(groupId).then((localGroup) => {
    if (disposed || localGroup) {
      refreshLocal();
      return;
    }
    unsubscribeCloud = subscribeCollection<ProductionEntry>(
      groupId,
      "entries",
      (cloudEntries) => { void emitLocalEntries(cloudEntries).catch(onError); },
      (cause) => {
        if (!isPermissionDenied(cause)) onError(cause);
        refreshLocal();
      },
      canReviewGroup ? [] : [where("workerId", "==", uid)],
    );
  }).catch(onError);
  return () => {
    disposed = true;
    unsubscribeLocal?.();
    unsubscribeCloud?.();
  };
}

export async function saveProductionOrder(
  groupId: string,
  order: Omit<ProductionOrder, "id" | "groupId">,
  id?: string,
): Promise<void> {
  const value = {
    groupId,
    code: requireText(order.code, "Mã đơn hàng", 100),
    po: requireText(order.po, "Mã PO", 100),
    color: requireText(order.color, "Màu sắc", 80),
    productName: requireText(order.productName, "Tên sản phẩm", 160),
    active: order.active,
  };
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    const orderId = id ?? crypto.randomUUID();
    await saveLocalProduction(localGroup.ownerId, groupId, "order", orderId, { id: orderId, ...value });
    return;
  }
  if (id) await updateDoc(doc(groupCollection(groupId, "orders"), id), value);
  else await addDoc(groupCollection(groupId, "orders"), value);
}

export async function deleteProductionOrder(groupId: string, orderId: string): Promise<void> {
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    const linked = await localRows<ProductionStage>(localGroup.ownerId, groupId, "stage");
    if (linked.some((stage) => stage.orderId === orderId)) throw new Error("Không thể xóa đơn hàng đang có công đoạn. Hãy xóa công đoạn trước.");
    await qdcomDB.localProduction.delete(`${localGroup.ownerId}:${groupId}:order:${orderId}`);
    notifyLocalProduction(localGroup.ownerId, groupId);
    return;
  }
  const linkedStages = await getDocs(query(groupCollection(groupId, "stages"), where("orderId", "==", orderId), limit(1)));
  if (!linkedStages.empty) throw new Error("Không thể xóa đơn hàng đang có công đoạn. Hãy xóa công đoạn trước.");
  await deleteDoc(doc(groupCollection(groupId, "orders"), orderId));
}

export async function saveProductionStage(
  groupId: string,
  stage: Omit<ProductionStage, "id" | "groupId">,
  id?: string,
): Promise<void> {
  if (!Number.isSafeInteger(stage.unitPriceVnd) || stage.unitPriceVnd < 0 || stage.unitPriceVnd > MAX_PRICE_VND) {
    throw new Error("Đơn giá phải là số nguyên VNĐ từ 0 đến 1.000.000.000.");
  }
  const value = {
    groupId,
    orderId: requireText(stage.orderId, "Đơn hàng", 160),
    name: requireText(stage.name, "Tên công đoạn", 100),
    line: requireText(stage.line, "Chuyền", 100),
    unitPriceVnd: stage.unitPriceVnd,
    active: stage.active,
  };
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    const stageId = id ?? crypto.randomUUID();
    await saveLocalProduction(localGroup.ownerId, groupId, "stage", stageId, { id: stageId, ...value });
    return;
  }
  if (id) await updateDoc(doc(groupCollection(groupId, "stages"), id), value);
  else await addDoc(groupCollection(groupId, "stages"), value);
}

export async function deleteProductionStage(groupId: string, stageId: string): Promise<void> {
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    const linked = await localRows<ProductionEntry>(localGroup.ownerId, groupId, "entry");
    if (linked.some((entry) => entry.stageId === stageId)) throw new Error("Không thể xóa công đoạn đã có sản lượng. Hãy chuyển công đoạn sang không hoạt động.");
    await qdcomDB.localProduction.delete(`${localGroup.ownerId}:${groupId}:stage:${stageId}`);
    notifyLocalProduction(localGroup.ownerId, groupId);
    return;
  }
  const linkedEntries = await getDocs(query(groupCollection(groupId, "entries"), where("stageId", "==", stageId), limit(1)));
  if (!linkedEntries.empty) throw new Error("Không thể xóa công đoạn đã có sản lượng. Hãy chuyển công đoạn sang không hoạt động.");
  await deleteDoc(doc(groupCollection(groupId, "stages"), stageId));
}

export async function saveProductionField(
  groupId: string,
  field: Omit<ProductionCustomField, "id" | "groupId">,
  id?: string,
): Promise<void> {
  const value = {
    groupId,
    label: requireText(field.label, "Tên trường", 100),
    type: field.type,
    unit: field.unit.trim().slice(0, 40),
    required: field.required,
  };
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    const fieldId = id ?? crypto.randomUUID();
    await saveLocalProduction(localGroup.ownerId, groupId, "field", fieldId, { id: fieldId, ...value });
    return;
  }
  if (id) await updateDoc(doc(groupCollection(groupId, "customFields"), id), value);
  else await addDoc(groupCollection(groupId, "customFields"), value);
}

export async function deleteProductionField(groupId: string, fieldId: string): Promise<void> {
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    await qdcomDB.localProduction.delete(`${localGroup.ownerId}:${groupId}:field:${fieldId}`);
    notifyLocalProduction(localGroup.ownerId, groupId);
    return;
  }
  await deleteDoc(doc(groupCollection(groupId, "customFields"), fieldId));
}

export async function submitProductionEntry(input: {
  group: ProductionGroup;
  workerId: string;
  workerName: string;
  order: ProductionOrder;
  stage: ProductionStage;
  date: string;
  quantity: number;
  customValues: Record<string, string>;
  correctionEntry?: ProductionEntry;
}): Promise<boolean> {
  const { group, workerId, order, stage } = input;
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QUANTITY) {
    throw new Error("Sản lượng phải là số nguyên từ 1 đến 1.000.000.");
  }
  if (stage.groupId !== group.id || order.groupId !== group.id || stage.orderId !== order.id) {
    throw new Error("Đơn hàng hoặc công đoạn không thuộc workspace đang chọn.");
  }
  if (!order.active || !stage.active) throw new Error("Đơn hàng hoặc công đoạn này đã ngừng nhận sản lượng.");
  const amountVnd = input.quantity * stage.unitPriceVnd;
  if (!Number.isSafeInteger(amountVnd)) throw new Error("Thành tiền vượt giới hạn tính toán chính xác.");
  const entry = {
    groupId: group.id,
    workerId,
    workerName: requireText(input.workerName, "Tên công nhân", 120),
    orderId: order.id,
    orderCode: order.code,
    po: order.po,
    color: order.color,
    stageId: stage.id,
    stageName: stage.name,
    line: stage.line,
    date: requireDate(input.date),
    quantity: input.quantity,
    unitPriceVnd: stage.unitPriceVnd,
    amountVnd,
    customValues: input.customValues,
    status: group.approvalRequired ? "pending" : "approved",
    reviewNote: "",
    reviewedBy: group.approvalRequired ? "" : workerId,
    reviewedAt: group.approvalRequired ? null : serverTimestamp(),
  };
  const localGroup = await findLocalGroup(group.id);
  if (localGroup) {
    const id = input.correctionEntry?.id ?? crypto.randomUUID();
    await saveLocalProduction(workerId, group.id, "entry", id, {
      id,
      ...entry,
      createdAt: input.correctionEntry?.createdAt ?? new Date().toISOString(),
      reviewedAt: group.approvalRequired ? null : new Date().toISOString(),
      localOnly: true,
    });
    return true;
  }
  if (input.correctionEntry) {
    if (input.correctionEntry.workerId !== workerId || input.correctionEntry.groupId !== group.id ||
      input.correctionEntry.status !== "revision_requested") {
      throw new Error("Chỉ có thể sửa lượt nhập của chính bạn đang được yêu cầu chỉnh sửa.");
    }
    try {
      await updateDoc(doc(groupCollection(group.id, "entries"), input.correctionEntry.id), {
        ...entry,
        createdAt: input.correctionEntry.createdAt,
      });
      return false;
    } catch (cause) {
      if (!isPermissionDenied(cause)) throw cause;
      await saveLocalProduction(workerId, group.id, "entry", input.correctionEntry.id, {
        id: input.correctionEntry.id,
        ...entry,
        createdAt: input.correctionEntry.createdAt ?? new Date().toISOString(),
        reviewedAt: group.approvalRequired ? null : new Date().toISOString(),
        localOnly: true,
      });
      return true;
    }
  } else {
    try {
      await addDoc(groupCollection(group.id, "entries"), { ...entry, createdAt: serverTimestamp() });
      return false;
    } catch (cause) {
      if (!isPermissionDenied(cause)) throw cause;
      const id = crypto.randomUUID();
      await saveLocalProduction(workerId, group.id, "entry", id, {
        id,
        ...entry,
        createdAt: new Date().toISOString(),
        reviewedAt: group.approvalRequired ? null : new Date().toISOString(),
        localOnly: true,
      });
      return true;
    }
  }
  return false;
}

export async function approveProductionEntries(groupId: string, entryIds: string[], uid: string): Promise<void> {
  if (!entryIds.length) return;
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    if (localGroup.ownerId !== uid) throw new Error("Chỉ trưởng nhóm trên thiết bị này mới được duyệt.");
    const entries = await localRows<ProductionEntry>(uid, groupId, "entry");
    for (const entry of entries.filter((item) => entryIds.includes(item.id) && item.status === "pending")) {
      await saveLocalProduction(uid, groupId, "entry", entry.id, {
        ...entry,
        status: "approved",
        reviewNote: "",
        reviewedBy: uid,
        reviewedAt: new Date().toISOString(),
      });
    }
    return;
  }
  for (let offset = 0; offset < entryIds.length; offset += 450) {
    const batch = writeBatch(db());
    entryIds.slice(offset, offset + 450).forEach((entryId) => {
      batch.update(doc(groupCollection(groupId, "entries"), entryId), {
        status: "approved",
        reviewNote: "",
        reviewedBy: uid,
        reviewedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export async function requestProductionCorrection(groupId: string, entryId: string, uid: string, note: string): Promise<void> {
  const localGroup = await findLocalGroup(groupId);
  if (localGroup) {
    if (localGroup.ownerId !== uid) throw new Error("Chỉ trưởng nhóm trên thiết bị này mới được yêu cầu sửa.");
    const entries = await localRows<ProductionEntry>(uid, groupId, "entry");
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || entry.status !== "pending") throw new Error("Không tìm thấy sản lượng cục bộ đang chờ duyệt.");
    await saveLocalProduction(uid, groupId, "entry", entryId, {
      ...entry,
      status: "revision_requested",
      reviewNote: requireText(note, "Lý do yêu cầu sửa", 500),
      reviewedBy: uid,
      reviewedAt: new Date().toISOString(),
    });
    return;
  }
  await updateDoc(doc(groupCollection(groupId, "entries"), entryId), {
    status: "revision_requested",
    reviewNote: requireText(note, "Lý do yêu cầu sửa", 500),
    reviewedBy: uid,
    reviewedAt: serverTimestamp(),
  });
}
