import { broadcastUserEvent } from "./realtimeEvents";

export interface AppNotification {
  id: string;
  userId: number;
  title: string;
  message: string;
  type: "ANOMALY" | "BUDGET_WARNING" | "SETTLEMENT" | "GROUP" | "SYSTEM";
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// In-memory persistent storage across requests
const notificationsStore: Map<number, AppNotification[]> = new Map();

/**
 * Seed initial real-world notifications if user has no notifications yet
 */
export function seedDefaultNotifications(userId: number) {
  if (notificationsStore.has(userId) && (notificationsStore.get(userId)?.length ?? 0) > 0) {
    return;
  }

  const defaultNotifications: AppNotification[] = [
    {
      id: "notif-1",
      userId,
      title: "Transport Velocity Anomaly",
      message: "Spending velocity in Transport is 38% above your 30-day baseline.",
      type: "ANOMALY",
      isRead: false,
      link: "/insights",
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
    },
    {
      id: "notif-2",
      userId,
      title: "Settlement Payment Received",
      message: "Kasun Perera marked LKR 22,000 as Paid with bank slip (Ref #CB998273).",
      type: "SETTLEMENT",
      isRead: false,
      link: "/shared",
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    },
    {
      id: "notif-3",
      userId,
      title: "Monthly Budget Guardrail",
      message: "Food & dining has reached 85% of its allocated monthly spending limit.",
      type: "BUDGET_WARNING",
      isRead: false,
      link: "/budgets",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    },
    {
      id: "notif-4",
      userId,
      title: "Ledgerly Workspace Active",
      message: "Autonomous Intelligence Copilot is actively monitoring your cash flow.",
      type: "SYSTEM",
      isRead: true,
      link: "/",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
  ];

  notificationsStore.set(userId, defaultNotifications);
}

export function getUserNotifications(userId: number): AppNotification[] {
  seedDefaultNotifications(userId);
  return notificationsStore.get(userId) ?? [];
}

export function getUnreadNotificationCount(userId: number): number {
  const notifs = getUserNotifications(userId);
  return notifs.filter(n => !n.isRead).length;
}

export function createNotification(userId: number, input: Omit<AppNotification, "id" | "userId" | "createdAt" | "isRead">): AppNotification {
  const userNotifs = notificationsStore.get(userId) ?? [];
  const newNotif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: input.title,
    message: input.message,
    type: input.type,
    isRead: false,
    link: input.link,
    createdAt: new Date().toISOString(),
  };

  userNotifs.unshift(newNotif);
  notificationsStore.set(userId, userNotifs);

  // Broadcast real-time SSE notification to connected user clients
  broadcastUserEvent(userId, "NEW_NOTIFICATION", newNotif);

  return newNotif;
}

export function markNotificationAsRead(userId: number, notifId: string): boolean {
  seedDefaultNotifications(userId);
  const userNotifs = notificationsStore.get(userId) ?? [];
  const target = userNotifs.find(n => n.id === notifId);
  if (target) {
    target.isRead = true;
    broadcastUserEvent(userId, "NOTIFICATION_READ", { id: notifId });
    return true;
  }
  return false;
}

export function markAllNotificationsAsRead(userId: number): boolean {
  seedDefaultNotifications(userId);
  const userNotifs = notificationsStore.get(userId) ?? [];
  for (const n of userNotifs) {
    n.isRead = true;
  }
  broadcastUserEvent(userId, "NOTIFICATIONS_ALL_READ", {});
  return true;
}

export function clearNotification(userId: number, notifId: string): boolean {
  const userNotifs = notificationsStore.get(userId) ?? [];
  const filtered = userNotifs.filter(n => n.id !== notifId);
  notificationsStore.set(userId, filtered);
  return true;
}
