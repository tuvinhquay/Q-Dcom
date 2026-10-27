import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const rules = readFileSync(resolve(process.cwd(), "../../firestore.rules"), "utf8");
const env = await initializeTestEnvironment({
  projectId: "demo-qdcom",
  firestore: { rules },
});

const auth = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "google.com" } }).firestore();

try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const stamp = new Date("2026-10-27T00:00:00.000Z");
    await setDoc(doc(db, "tenants", "tenant-a"), { name: "Xưởng A", ownerUid: "admin-a", active: true, createdAt: stamp });
    await setDoc(doc(db, "tenants", "tenant-b"), { name: "Xưởng B", ownerUid: "admin-b", active: true, createdAt: stamp });
    for (const [tenantId, uid, role] of [
      ["tenant-a", "admin-a", "admin"],
      ["tenant-a", "worker-a", "worker"],
      ["tenant-a", "worker-b", "worker"],
      ["tenant-b", "admin-b", "admin"],
    ]) {
      await setDoc(doc(db, "tenants", tenantId, "members", uid), {
        tenantId, uid, role, displayName: uid, employeeCode: uid, active: true, createdAt: stamp,
      });
    }
    await setDoc(doc(db, "tenants", "tenant-a", "purchaseOrders", "po-a"), {
      tenantId: "tenant-a", poCode: "PO-A", productName: "Áo", totalQuantity: 100, dueAt: "2026-11-01",
    });
    await setDoc(doc(db, "tenants", "tenant-b", "purchaseOrders", "po-b"), {
      tenantId: "tenant-b", poCode: "PO-B", productName: "Quần", totalQuantity: 100, dueAt: "2026-11-01",
    });
    await setDoc(doc(db, "tenants", "tenant-a", "earnings", "worker-a"), {
      tenantId: "tenant-a", workerUid: "worker-a", approvedQuantity: 50, approvedEarnings: 500000,
    });
    await setDoc(doc(db, "tenants", "tenant-a", "workerExtras", "pending-extra"), {
      tenantId: "tenant-a", workerUid: "worker-a", status: "pending", amount: 50000, description: "Tăng ca",
    });
    await setDoc(doc(db, "tenants", "tenant-a", "workerExtras", "approved-extra"), {
      tenantId: "tenant-a", workerUid: "worker-a", status: "approved", amount: 50000, description: "Thưởng",
    });
    await setDoc(doc(db, "tenants", "tenant-a", "rooms", "main", "messages", "hello"), {
      tenantId: "tenant-a", senderId: "worker-a", senderName: "Worker A", text: "Xin chào", createdAt: stamp,
    });
  });

  const adminA = auth("admin-a");
  const workerA = auth("worker-a");
  const workerB = auth("worker-b");

  await assertSucceeds(getDoc(doc(workerA, "tenants", "tenant-a", "purchaseOrders", "po-a")));
  await assertFails(getDoc(doc(workerA, "tenants", "tenant-b", "purchaseOrders", "po-b")));
  await assertSucceeds(getDoc(doc(workerA, "tenants", "tenant-a", "earnings", "worker-a")));
  await assertFails(getDoc(doc(adminA, "tenants", "tenant-a", "earnings", "worker-a")));
  await assertFails(getDoc(doc(workerB, "tenants", "tenant-a", "earnings", "worker-a")));
  await assertSucceeds(getDoc(doc(adminA, "tenants", "tenant-a", "workerExtras", "pending-extra")));
  await assertFails(getDoc(doc(adminA, "tenants", "tenant-a", "workerExtras", "approved-extra")));
  await assertFails(getDoc(doc(workerB, "tenants", "tenant-a", "workerExtras", "pending-extra")));
  await assertSucceeds(getDoc(doc(workerA, "tenants", "tenant-a", "rooms", "main", "messages", "hello")));

  await assertSucceeds(setDoc(doc(workerA, "tenants", "tenant-a", "productionEntries", "entry-a"), {
    tenantId: "tenant-a", workerUid: "worker-a", workerName: "Worker A", purchaseOrderId: "po-a",
    operationId: "sew", operationName: "May", quantity: 5, workDate: "2026-10-27",
    status: "pending", submittedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(workerA, "tenants", "tenant-a", "productionEntries", "forged-entry"), {
    tenantId: "tenant-a", workerUid: "worker-b", workerName: "Worker B", purchaseOrderId: "po-a",
    operationId: "sew", operationName: "May", quantity: 5, workDate: "2026-10-27",
    status: "pending", submittedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(workerA, "tenants", "tenant-a", "earnings", "worker-a"), {
    tenantId: "tenant-a", workerUid: "worker-a", approvedQuantity: 999999, approvedEarnings: 999999999,
  }));

  console.log("PASS: tenant isolation, worker identity, private earnings, pending-extra review, and tenant chat rules.");
} finally {
  await env.cleanup();
}
