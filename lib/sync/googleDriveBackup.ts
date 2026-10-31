const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_FILES_API = `${DRIVE_API}/files`;
const BACKUP_NAME = "Q-Dcom_Backup.json.gz";

export interface GoogleDriveStorageQuota {
  usedBytes: number;
  totalBytes: number | null;
}

async function checkedFetch(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive trả về lỗi ${response.status}${detail ? `: ${detail}` : "."}`);
  }
  return response;
}

function authorization(accessToken: string): HeadersInit {
  if (!accessToken.trim()) throw new Error("Phiên Google Drive không hợp lệ. Hãy kết nối lại tài khoản Google.");
  return { Authorization: `Bearer ${accessToken}` };
}

async function gzip(contents: string): Promise<Blob> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("Trình duyệt không hỗ trợ nén backup Gzip. Hãy tải file JSON về máy thay thế.");
  }
  const source = new Blob([contents]).stream();
  return new Response(source.pipeThrough(new CompressionStream("gzip"))).blob();
}

export async function syncBackupToGoogleDrive(accessToken: string, contents: string, tenantId = "local-default"): Promise<void> {
  const headers = authorization(accessToken);
  const safeTenantId = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "local-default";
  // Keep the legacy backup filename for the default tenant and isolate each additional tenant.
  const backupName = safeTenantId === "local-default" ? BACKUP_NAME : `Q-Dcom_Backup_${safeTenantId}.json.gz`;
  const query = new URLSearchParams({
    spaces: "appDataFolder",
    pageSize: "10",
    fields: "files(id,name)",
    q: `name = '${backupName}' and 'appDataFolder' in parents and trashed = false`,
  });
  const listResponse = await checkedFetch(`${DRIVE_FILES_API}?${query}`, { headers });
  const listing = await listResponse.json() as { files?: Array<{ id?: string; name?: string }> };
  const existingFileId = listing.files?.find((file) => typeof file.id === "string")?.id;
  const compressed = await gzip(contents);
  const metadata = {
    name: backupName,
    mimeType: "application/gzip",
    ...(existingFileId ? {} : { parents: ["appDataFolder"] }),
  };
  const uploadUrl = new URL(existingFileId
    ? `${DRIVE_FILES_API}/${encodeURIComponent(existingFileId)}`
    : DRIVE_FILES_API);
  uploadUrl.pathname = `/upload${uploadUrl.pathname}`;
  uploadUrl.searchParams.set("uploadType", "resumable");
  uploadUrl.searchParams.set("fields", "id");

  const uploadSession = await checkedFetch(uploadUrl.toString(), {
    method: existingFileId ? "PATCH" : "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/gzip",
      "X-Upload-Content-Length": String(compressed.size),
    },
    body: JSON.stringify(metadata),
  });
  const resumableUrl = uploadSession.headers.get("Location");
  if (!resumableUrl) throw new Error("Google Drive không trả về URL để tải bản backup lên.");

  await checkedFetch(resumableUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/gzip" },
    body: compressed,
  });
}

export async function getGoogleDriveStorageQuota(accessToken: string): Promise<GoogleDriveStorageQuota> {
  const query = new URLSearchParams({ fields: "storageQuota(limit,usage,usageInDrive)" });
  const response = await checkedFetch(`${DRIVE_API}/about?${query}`, { headers: authorization(accessToken) });
  const result = await response.json() as {
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
  };
  const quota = result.storageQuota;
  if (!quota) throw new Error("Google Drive không trả về thông tin dung lượng.");
  const usedBytes = Number(quota.usageInDrive ?? quota.usage);
  const totalBytes = quota.limit === undefined ? null : Number(quota.limit);
  if (!Number.isFinite(usedBytes) || (totalBytes !== null && (!Number.isFinite(totalBytes) || totalBytes <= 0))) {
    throw new Error("Google Drive trả về thông tin dung lượng không hợp lệ.");
  }
  return { usedBytes, totalBytes };
}
