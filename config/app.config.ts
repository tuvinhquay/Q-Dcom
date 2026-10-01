const pocketBaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() ?? "";

export const appConfig = {
  app: {
    name: "Q-Dcom",
    publicUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000",
  },
  features: {
    useLocalServer: process.env.NEXT_PUBLIC_USE_LOCAL_SERVER === "true",
  },
  integrations: {
    pocketbase: {
      baseUrl: pocketBaseUrl.replace(/\/+$/, ""),
      collection: process.env.NEXT_PUBLIC_POCKETBASE_COLLECTION?.trim() || "products",
      healthPath: "/api/health",
      pageSize: 200,
    },
  },
} as const;

export function getPocketBaseBaseUrl(override = "") {
  const value = (override.trim() || appConfig.integrations.pocketbase.baseUrl).replace(/\/+$/, "");
  if (!value) throw new Error("Hãy nhập địa chỉ máy chủ PocketBase trước.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Địa chỉ máy chủ phải là URL hợp lệ.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Máy chủ chỉ hỗ trợ giao thức HTTP hoặc HTTPS.");
  }
  return url.toString().replace(/\/+$/, "");
}