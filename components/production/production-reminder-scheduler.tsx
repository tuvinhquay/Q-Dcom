"use client";

import { useEffect, useEffectEvent } from "react";

/** Keeps opted-in production reminders active while the signed-in Q-Dcom shell is open. */
export function ProductionReminderScheduler({ uid, onError }: { uid: string | null; onError: (message: string) => void }) {
  const reportError = useEffectEvent(onError);
  useEffect(() => {
    if (!uid || typeof Notification === "undefined") return;
    const storageKey = `qdcom.production-reminder.${uid}`;
    let lastError = "";
    const timer = window.setInterval(() => {
      if (Notification.permission !== "granted") return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        const settings: unknown = raw ? JSON.parse(raw) : null;
        if (!settings || typeof settings !== "object") return;
        const value = settings as { enabled?: unknown; hours?: unknown; lastNotifiedAt?: unknown };
        if (value.enabled !== true) return;
        const hours = value.hours === 2 || value.hours === 3 ? value.hours : 1;
        const lastNotifiedAt = typeof value.lastNotifiedAt === "number" ? value.lastNotifiedAt : Date.now();
        if (Date.now() - lastNotifiedAt < hours * 60 * 60 * 1000) return;
        new Notification("Q-Dcom · Nhắc nộp sản lượng", {
          body: "Hãy cập nhật sản lượng để theo dõi tiến độ và thu nhập của bạn.",
          tag: `qdcom-production-${uid}`,
        });
        window.localStorage.setItem(storageKey, JSON.stringify({
          enabled: true,
          hours,
          lastNotifiedAt: Date.now(),
        }));
        lastError = "";
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Không thể gửi nhắc nộp sản lượng.";
        if (lastError !== message) reportError(message);
        lastError = message;
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [uid]);

  return null;
}
