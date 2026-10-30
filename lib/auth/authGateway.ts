import { getFirebaseAuth } from "@/lib/firebase";
import { getTenantPrincipal } from "@/lib/services/tenantService";
import type { TenantPrincipal } from "@/lib/tenancy/authorization";

export type AuthenticationState =
  | "signed_out"
  | "authenticating"
  | "loading_memberships"
  | "tenant_selection"
  | "authorized"
  | "no_membership"
  | "membership_disabled"
  | "error";

export interface TenantAuthorizationResult {
  state: "authorized";
  principal: TenantPrincipal;
}

/**
 * Resolves tenant access from the live Firebase Auth session and Firestore
 * Membership document. Local profile data and employee codes are never
 * accepted as a substitute for a Firebase Auth identity.
 */
export async function authorizeTenantSession(
  tenantId: string,
  employeeCode?: string,
): Promise<TenantAuthorizationResult> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    throw new Error("signed_out: Hãy đăng nhập bằng tài khoản Google trước khi kết nối xưởng.");
  }

  await user.getIdToken();
  const principal = await getTenantPrincipal(user.uid, tenantId, employeeCode);

  if (principal.uid !== user.uid || principal.tenantId !== tenantId) {
    throw new Error("error: Không thể xác minh danh tính thành viên của xưởng.");
  }

  return { state: "authorized", principal };
}
