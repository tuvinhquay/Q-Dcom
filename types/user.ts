export type UserRole = "admin" | "warehouse_manager" | "warehouse_staff" | "viewer";

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  role: UserRole;
  warehouse_ids: string[];
}