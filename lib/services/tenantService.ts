import { collection, doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { TenantMembership, TenantRole } from "@/types/tenant";
import type { TenantPrincipal } from "@/lib/tenancy/authorization";

export type TenantAccessErrorCode = "tenant_not_found" | "tenant_disabled" | "no_membership" | "membership_disabled" | "membership_invalid" | "employee_code_mismatch";

export class TenantAccessError extends Error {
  constructor(public readonly code: TenantAccessErrorCode, message: string) {
    super(message);
    this.name = "TenantAccessError";
  }
}

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
export async function getTenantPrincipal(uid: string, tenantId: string, employeeCode?: string): Promise<TenantPrincipal> {
  if (!uid || !tenantId) {
    throw new TenantAccessError("membership_invalid", "Thiếu tài khoản hoặc mã xưởng.");
  }

  // Read the caller's own Membership first. Rules permit this narrow self-read
  // even when the member is inactive or has not yet been added.
  const memberSnapshot = await getDoc(doc(db(), "tenants", tenantId, "members", uid));
  if (!memberSnapshot.exists()) {
    throw new TenantAccessError("no_membership", "Tài khoản chưa được thêm vào xưởng này.");
  }

  const membership = memberSnapshot.data() as TenantMembership;
  if (membership.active !== true) {
    throw new TenantAccessError("membership_disabled", "Thẻ thành viên đã bị vô hiệu hóa. Hãy liên hệ người quản lý.");
  }
  if (membership.tenantId !== tenantId || membership.uid !== uid ||
      (membership.role !== "admin" && membership.role !== "worker")) {
    throw new TenantAccessError("membership_invalid", "Thông tin thành viên xưởng không hợp lệ.");
  }
  if (employeeCode !== undefined && membership.employeeCode !== employeeCode.trim()) {
    throw new TenantAccessError("employee_code_mismatch", "Mã thẻ nhân viên không khớp với tài khoản Google này.");
  }

  const tenantSnapshot = await getDoc(doc(db(), "tenants", tenantId));
  if (!tenantSnapshot.exists()) {
    throw new TenantAccessError("tenant_not_found", "Xưởng không tồn tại.");
  }
  if (tenantSnapshot.data().active !== true) {
    throw new TenantAccessError("tenant_disabled", "Xưởng hiện đã bị khóa. Hãy liên hệ người quản lý.");
  }

  return { uid, tenantId, role: membership.role as TenantRole };
}
