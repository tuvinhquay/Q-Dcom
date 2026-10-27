import type { TenantRole } from "@/types/tenant";

export interface TenantPrincipal {
  uid: string;
  tenantId: string;
  role: TenantRole;
}

export type QBotPermission = "inventory_lookup" | "operation_procedure" | "tenant_overview" | "purchase_orders" | "productivity_report" | "personal_wallet" | "financial_detail" | "other_worker_earnings" | "confidential_document";

const sensitiveTerms = [
  "thu nhap tho khac", "luong tho khac", "tien cua tho", "don gia tong", "tong tien",
  "tai chinh", "loi nhuan", "bao mat", "tai lieu mat", "luong cua", "thu nhap cua",
  "bang luong", "so tien cua",
];
const overviewTerms = ["tong san luong", "tien do tong", "bao cao nang suat", "danh sach po", "don hang po", "toan xuong", "toan bo kho"];
const personalWalletTerms = ["vi cua toi", "vi ca nhan", "thu nhap cua toi", "tien cua toi", "luong cua toi", "san luong cua toi"];
const procedureTerms = ["quy trinh", "cong doan", "cach may", "huong dan thao tac"];
const inventoryTerms = ["ton kho", "con hang", "o dau", "vi tri", "ma hang", "ke nao", "bao nhieu cai"];

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");
}

export function classifyQBotPermission(question: string): QBotPermission {
  const text = normalize(question);
  // A request explicitly scoped to the current user's own wallet is not a request for another worker's income.
  if (personalWalletTerms.some((term) => text.includes(normalize(term))) && /toi|minh|ca nhan/.test(text)) return "personal_wallet";
  if (sensitiveTerms.some((term) => text.includes(normalize(term)))) return "financial_detail";
  if (overviewTerms.some((term) => text.includes(normalize(term)))) return "tenant_overview";
  if (procedureTerms.some((term) => text.includes(normalize(term)))) return "operation_procedure";
  if (inventoryTerms.some((term) => text.includes(normalize(term)))) return "inventory_lookup";
  return "other";
}

/**
 * This is a policy helper, not a substitute for server-enforced authorization.
 * Roles and tenant membership must be verified from a trusted source before use.
 */
export function canAskQBot(principal: TenantPrincipal, question: string): { allowed: boolean; permission: QBotPermission; reason?: string } {
  if (!principal.uid || !principal.tenantId) {
    return { allowed: false, permission: "other", reason: "Không xác định được tài khoản hoặc xưởng hiện tại." };
  }

  const permission = classifyQBotPermission(question);
  if (permission === "financial_detail" || permission === "other_worker_earnings" || permission === "confidential_document") {
    return { allowed: false, permission, reason: "Q-Bot không thể cung cấp dữ liệu tài chính cá nhân hoặc tài liệu mật qua câu hỏi này." };
  }
  if (principal.role === "worker" && permission === "tenant_overview") {
    return { allowed: false, permission, reason: "Bạn không có quyền xem báo cáo tổng hợp của xưởng." };
  }
  if (principal.role === "worker" && !["inventory_lookup", "operation_procedure", "personal_wallet"].includes(permission)) {
    return { allowed: false, permission, reason: "Tài khoản công nhân chỉ được tra cứu mã hàng/vị trí, quy trình công đoạn và ví cá nhân." };
  }
  return { allowed: true, permission };
}

export function assertSameTenant(principal: TenantPrincipal, recordTenantId: string): void {
  if (!principal.tenantId || principal.tenantId !== recordTenantId) {
    throw new Error("Từ chối truy cập: dữ liệu không thuộc xưởng hiện tại.");
  }
}

export function canReadPersonalEarnings(principal: TenantPrincipal, workerUid: string): boolean {
  return principal.role === "worker" && principal.uid === workerUid;
}
