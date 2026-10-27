import { collection, doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { TenantMembership, TenantRole } from "@/types/tenant";
import type { TenantPrincipal } from "@/lib/tenancy/authorization";

const db = () => getFirebaseFirestore();

export async function createTenant(input: { name: string; uid: string; displayName: string; employeeCode: string }): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 120 || !input.uid || !input.displayName.trim() || !input.employeeCode.trim()) {
    throw new Error("Cần nhập tên xưởng, tên người quản lý và mã nhân viên hợp lệ.");
  }
  const tenantRef = doc(collection(db(), "tenants"));
  const memberRef = doc(db(), "tenants", tenantRef.id, "members", input.uid);
  await runTransaction(db(), async (transaction) => {
    transaction.set(tenantRef, { name, ownerUid: input.uid, active: true, createdAt: serverTimestamp() });
    transaction.set(memberRef, {
      tenantId: tenantRef.id,
      uid: input.uid,
      role: "admin",
      displayName: input.displayName.trim(),
      employeeCode: input.employeeCode.trim(),
      active: true,
      createdAt: serverTimestamp(),
    });
  });
  return tenantRef.id;
}

/** Role is loaded from the tenant membership document, not accepted from UI/chat text. */
export async function getTenantPrincipal(uid: string, tenantId: string): Promise<TenantPrincipal> {
  if (!uid || !tenantId) throw new Error("Thiếu tài khoản hoặc mã xưởng.");
  const [tenantSnapshot, memberSnapshot] = await Promise.all([
    getDoc(doc(db(), "tenants", tenantId)),
    getDoc(doc(db(), "tenants", tenantId, "members", uid)),
  ]);
  if (!tenantSnapshot.exists() || tenantSnapshot.data().active !== true) throw new Error("Xưởng không tồn tại hoặc đã bị khóa.");
  if (!memberSnapshot.exists()) throw new Error("Tài khoản chưa được thêm vào xưởng này.");
  const membership = memberSnapshot.data() as TenantMembership;
  if (membership.tenantId !== tenantId || membership.uid !== uid || membership.active !== true ||
      (membership.role !== "admin" && membership.role !== "worker")) {
    throw new Error("Thông tin thành viên xưởng không hợp lệ.");
  }
  return { uid, tenantId, role: membership.role as TenantRole };
}
