"use client";

import type { ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return clientId ? <GoogleOAuthProvider clientId={clientId} locale="vi">{children}</GoogleOAuthProvider> : children;
}
