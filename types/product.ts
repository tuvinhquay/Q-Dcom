export type ProductStatus = "available" | "low_stock" | "out_of_stock" | "hidden";

export interface Product {
  id: string;
  name: string;
  brand: string;
  color: string;
  size: string[];
  quantity: number;
  price?: number;
  image_urls: string[];
  image_notes: string;
  description: string;
  category: string;
  status: ProductStatus;
  location: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  search_keywords: string[];
}