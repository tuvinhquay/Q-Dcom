export interface Inventory {
  id: string;
  product_id: string;
  warehouse_id: string;
  location: string;
  quantity: number;
  reserved_quantity: number;
  updated_at: string;
}

export interface InventorySummary {
  product_count: number;
  total_quantity: number;
  low_stock_count: number;
  out_of_stock_count: number;
  active_location_count: number;
}