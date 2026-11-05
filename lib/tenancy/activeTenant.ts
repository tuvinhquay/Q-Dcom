import { DEFAULT_TENANT_ID } from "@/lib/db/qdcomDB";

const ACTIVE_TENANT_KEY = "qdcom.activeTenantId.v1";
const TENANT_CHANGE_EVENT = "qdcom:tenant-changed";

export function getActiveTenantId(): string {
  if (typeof window === "undefined") return DEFAULT_TENANT_ID;
  try {
    const stored = window.localStorage.getItem(ACTIVE_TENANT_KEY);
    return stored?.trim() || DEFAULT_TENANT_ID;
  } catch {
    return DEFAULT_TENANT_ID;
  }
}

/** The selected tenant is a UI selector only; Firestore rules remain the authorization boundary. */
export function setActiveTenantId(tenantId: string): void {
  if (typeof window === "undefined") return;
  const next = tenantId.trim() || DEFAULT_TENANT_ID;
  window.localStorage.setItem(ACTIVE_TENANT_KEY, next);
  window.dispatchEvent(new CustomEvent(TENANT_CHANGE_EVENT, { detail: { tenantId: next } }));
}

export function subscribeActiveTenantChange(callback: (tenantId: string) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ tenantId?: string }>;
    callback(typeof custom.detail?.tenantId === "string" ? custom.detail.tenantId : getActiveTenantId());
  };
  window.addEventListener(TENANT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(TENANT_CHANGE_EVENT, handler);
}
