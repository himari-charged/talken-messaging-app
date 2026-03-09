/**
 * Browser notifications for new messages. Request permission and show when app is in background.
 */

const TITLE = "Talken";

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function canShowNotification(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted" && document.hidden;
}

export function showNewMessageNotification(senderName: string, preview: string): void {
  if (!canShowNotification()) return;
  try {
    new Notification(TITLE, {
      body: `${senderName}: ${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}`,
      icon: "/vite.svg",
    });
  } catch {
    // ignore
  }
}
