/**
 * Models for tenant-scoped workshop operations.
 * tenantId is mandatory for all workshop/business records; never infer it from user input.
 */
export type TenantRole = "admin" | "worker";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type ProductionPeriod = "day" | "week" | "month" | "quarter" | "year";

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  ownerUid: string;
  active: boolean;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  uid: string;
  role: TenantRole;
  displayName: string;
  employeeCode: string;
  active: boolean;
  createdAt: string;
}

export interface OperationRate {
  operationId: string;
  operationName: string;
  unitRate: number;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  poCode: string;
  productName: string;
  color: string;
  totalQuantity: number;
  receivedAt: string;
  dueAt: string;
  operationRates: OperationRate[];
  /** Operation names visible to tenant workers; rates remain admin-only. */
  operations?: Array<Pick<OperationRate, "operationId" | "operationName">>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionEntry {
  id: string;
  tenantId: string;
  workerUid: string;
  workerName: string;
  purchaseOrderId: string;
  operationId: string;
  operationName: string;
  quantity: number;
  workDate: string;
  status: ReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface WorkerExtra {
  id: string;
  tenantId: string;
  workerUid: string;
  category: "overtime" | "productivity_bonus" | "commission" | "other";
  description: string;
  amount: number;
  workDate: string;
  status: ReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface TenantOperationsSettings {
  id: string;
  tenantId: string;
  submissionIntervalHours: number;
  updatedAt: string;
}

export interface PersonalEarningsSummary {
  tenantId: string;
  workerUid: string;
  period: ProductionPeriod;
  periodStart: string;
  periodEnd: string;
  approvedQuantity: number;
  approvedEarnings: number;
}
