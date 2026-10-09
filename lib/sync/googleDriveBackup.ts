const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const BACKUP_NAME = "Q-Dcom_Backup.json";

async function checkedFetch(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive trả về lỗi ${response.status}${detail ? `: ${detail}` : "."}`);
  }
  return response;
}

export async function syncBackupToGoogleDrive(accessToken: string, contents: string): Promise<void> {
  const query = new URLSearchParams({
    spaces: "appDataFolder",
    pageSize: "1",
    fields: "files(id)",
    q: `name = '${BACKUP_NAME}' and 'appDataFolder' in parents and trashed = false`,
  });
  const listResponse = await checkedFetch(`${DRIVE_API}?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listing = await listResponse.json() as { files?: Array<{ id?: string }> };
  const fileId = listing.files?.[0]?.id;
  const metadata = fileId ? { name: BACKUP_NAME } : { name: BACKUP_NAME, parents: ["appDataFolder"] };
  const uploadUrl = new URL(fileId ? `${DRIVE_API}/${encodeURIComponent(fileId)}` : DRIVE_API);
  uploadUrl.pathname = `/upload${uploadUrl.pathname}`;
  uploadUrl.searchParams.set("uploadType", "resumable");
  uploadUrl.searchParams.set("fields", "id");
  const contentsLength = new TextEncoder().encode(contents).byteLength;
  const uploadSession = await checkedFetch(uploadUrl.toString(), {
    method: fileId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/json",
      "X-Upload-Content-Length": String(contentsLength),
    },
    body: JSON.stringify(metadata),
  });
  const resumableUrl = uploadSession.headers.get("Location");
  if (!resumableUrl) throw new Error("Google Drive không trả về URL để tải bản backup lên.");

  await checkedFetch(resumableUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: contents,
  });
}
