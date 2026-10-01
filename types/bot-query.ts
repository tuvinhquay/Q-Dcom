export type BotQueryIntent = "CHECK_QUANTITY" | "CHECK_LOCATION" | "GREETING" | "SHOW_CARD" | "SEARCH";

export interface BotQuery {
  text: string;
  normalized_text: string;
  tokens: string[];
  intent: BotQueryIntent;
  product_ids: string[];
  created_at: string;
}