import { appConfig, getPocketBaseBaseUrl } from "@/config/app.config";

export interface TunnelConnection {
  origin: string;
  status: number;
}

/** Kiểm tra PocketBase qua URL công khai do Cloudflare Tunnel hoặc reverse proxy cung cấp. */
export async function probeCloudflareTunnel(serverUrl: string): Promise<TunnelConnection> {
  const origin = getPocketBaseBaseUrl(serverUrl);
  const response = await fetch(`${origin}${appConfig.integrations.pocketbase.healthPath}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Máy chủ phản hồi HTTP ${response.status}.`);
  return { origin, status: response.status };
}