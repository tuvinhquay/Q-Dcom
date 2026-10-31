import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

initializeApp();
const db = getFirestore();

type Period = "day" | "week" | "month" | "quarter" | "year";
type Aggregate = { period: Period; periodKey: string; approvedQuantity: number; approvedEarnings: number };

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodKeys(input: string): Array<{ period: Period; periodKey: string }> {
  const parsed = new Date(input.length === 10 ? `${input}T00:00:00.000Z` : input);
  if (Number.isNaN(parsed.getTime())) return [];
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  const date = dateKey(parsed);
  const monday = new Date(Date.UTC(year, parsed.getUTCMonth(), day));
  const dayOfWeek = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return [
    { period: "day", periodKey: date },
    { period: "week", periodKey: dateKey(monday) },
    { period: "month", periodKey: `${year}-${String(month).padStart(2, "0")}` },
    { period: "quarter", periodKey: `${year}-Q${quarter}` },
    { period: "year", periodKey: String(year) },
  ];
}

function rateDocumentId(purchaseOrderId: string, operationId: string): string {
  return `${purchaseOrderId}__${operationId}`.replaceAll("/", "_");
}

async function rebuildWorkerEarnings(tenantId: string, workerUid: string): Promise<void> {
  if (!tenantId || !workerUid) return;
  const tenant = db.collection("tenants").doc(tenantId);
  const [entriesSnapshot, extrasSnapshot, oldPeriodsSnapshot] = await Promise.all([
    tenant.collection("productionEntries").where("workerUid", "==", workerUid).get(),
    tenant.collection("workerExtras").where("workerUid", "==", workerUid).get(),
    tenant.collection("earnings").doc(workerUid).collection("periods").get(),
  ]);
  const totals = new Map<string, Aggregate>();
  let lifetimeQuantity = 0;
  let lifetimeEarnings = 0;

  for (const entryDoc of entriesSnapshot.docs) {
    const entry = entryDoc.data();
    if (entry.status !== "approved") continue;
    const quantity = Number(entry.quantity);
    const workDate = String(entry.workDate ?? "");
    if (!Number.isSafeInteger(quantity) || quantity <= 0) continue;
    const rateId = rateDocumentId(String(entry.purchaseOrderId ?? ""), String(entry.operationId ?? ""));
    const rateSnapshot = await tenant.collection("operationRates").doc(rateId).get();
    const unitRate = Number(rateSnapshot.data()?.unitRate ?? 0);
    const earnings = Number.isFinite(unitRate) && unitRate >= 0 ? quantity * unitRate : 0;
    lifetimeQuantity += quantity;
    lifetimeEarnings += earnings;
    for (const key of periodKeys(workDate)) {
      const id = `${key.period}_${key.periodKey}`;
      const aggregate = totals.get(id) ?? { ...key, approvedQuantity: 0, approvedEarnings: 0 };
      aggregate.approvedQuantity += quantity;
      aggregate.approvedEarnings += earnings;
      totals.set(id, aggregate);
    }
  }

  for (const extraDoc of extrasSnapshot.docs) {
    const extra = extraDoc.data();
    if (extra.status !== "approved") continue;
    const amount = Number(extra.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    lifetimeEarnings += amount;
    for (const key of periodKeys(String(extra.workDate ?? ""))) {
      const id = `${key.period}_${key.periodKey}`;
      const aggregate = totals.get(id) ?? { ...key, approvedQuantity: 0, approvedEarnings: 0 };
      aggregate.approvedEarnings += amount;
      totals.set(id, aggregate);
    }
  }

  const earningsRef = tenant.collection("earnings").doc(workerUid);
  await earningsRef.set({
    tenantId,
    workerUid,
    approvedQuantity: lifetimeQuantity,
    approvedEarnings: lifetimeEarnings,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const activeIds = new Set<string>();
  for (const [id, aggregate] of totals) {
    activeIds.add(id);
    await earningsRef.collection("periods").doc(id).set({
      tenantId,
      workerUid,
      ...aggregate,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  for (const oldPeriod of oldPeriodsSnapshot.docs) {
    if (!activeIds.has(oldPeriod.id)) await oldPeriod.ref.delete();
  }
}

export const onProductionEntryChanged = onDocumentWritten(
  "tenants/{tenantId}/productionEntries/{entryId}",
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    if (data?.workerUid) await rebuildWorkerEarnings(event.params.tenantId, String(data.workerUid));
  },
);

export const onWorkerExtraChanged = onDocumentWritten(
  "tenants/{tenantId}/workerExtras/{extraId}",
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    if (data?.workerUid) await rebuildWorkerEarnings(event.params.tenantId, String(data.workerUid));
  },
);

export const onOperationRateChanged = onDocumentWritten(
  "tenants/{tenantId}/operationRates/{rateId}",
  async (event) => {
    const tenantId = event.params.tenantId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const purchaseOrderId = String(after?.purchaseOrderId ?? before?.purchaseOrderId ?? "");
    const operationId = String(after?.operationId ?? before?.operationId ?? "");
    if (!purchaseOrderId || !operationId) return;
    const entries = await db.collection("tenants").doc(tenantId).collection("productionEntries")
      .where("purchaseOrderId", "==", purchaseOrderId)
      .where("operationId", "==", operationId).get();
    const workers = new Set(entries.docs.map((entry) => String(entry.data().workerUid ?? "")).filter(Boolean));
    await Promise.all([...workers].map((uid) => rebuildWorkerEarnings(tenantId, uid)));
  },
);
