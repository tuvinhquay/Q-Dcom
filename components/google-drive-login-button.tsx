"use client";

import { useState } from "react";
import { signInWithGooglePopup, type GoogleAuthSession } from "@/lib/firebase";

export function GoogleDriveLoginButton({
  label,
  onAuthorized,
  onError,
}: {
  label: string;
  onAuthorized: (session: GoogleAuthSession) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function startLogin() {
    setBusy(true);
    try {
      const session = await signInWithGooglePopup();
      await onAuthorized(session);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Không thể hoàn tất đăng nhập Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="google-drive-button" type="button" onClick={() => void startLogin()} disabled={busy}>
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M43.6 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-9 6-15.6Z" />
        <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.9 1.3-4.1 2.1-6.8 2.1-5.2 0-9.6-3.5-11.2-8.2H5.9v5.4A20 20 0 0 0 24 44Z" />
        <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.4H5.9a20 20 0 0 0 0 18.4l6.9-5.4Z" />
        <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.9 14.8l6.9 5.4C14.4 15.5 18.8 12 24 12Z" />
      </svg>
      {busy ? "ĐANG KẾT NỐI GOOGLE…" : label}
    </button>
  );
}
