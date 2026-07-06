import { getCollection, writeCollection } from "@/lib/local-store";
import {
  createNotification as createNotificationOnServer,
  deleteNotification as deleteNotificationOnServer,
  fetchNotifications as fetchNotificationsFromServer,
  hideNotification as hideNotificationOnServer,
  markNotificationRead as markNotificationReadOnServer,
} from "@/app/lib/notifications-client";
import {
  NotificationCategory,
  NotificationPayload,
  NotificationRecord,
} from "@/lib/types/notifications";

const NOTIFICATIONS_KEY = "notifications";

export interface Notification extends NotificationRecord {}

function getStorageNotifications(): NotificationRecord[] {
  return getCollection<NotificationRecord>(NOTIFICATIONS_KEY) || [];
}

export function getNotifications(tenantId?: string): NotificationRecord[] {
  const notifications = getStorageNotifications();
  if (!tenantId) return notifications;
  return notifications.filter(
    (notification) => !notification.hiddenFor?.includes(tenantId),
  );
}

function writeNotifications(notifications: NotificationRecord[]) {
  writeCollection(NOTIFICATIONS_KEY, notifications);
}

export function addLocalNotification(
  payload: NotificationPayload,
): NotificationRecord {
  const newNotification: NotificationRecord = {
    id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    read: false,
    hiddenFor: [],
    ...payload,
  };

  try {
    const existing = getStorageNotifications();
    writeNotifications([newNotification, ...existing]);
  } catch (error) {
    console.error("Failed to persist local notification", error);
  }

  return newNotification;
}

export async function createNotification(
  payload: NotificationPayload,
): Promise<NotificationRecord> {
  const localNotification = addLocalNotification(payload);

  createNotificationOnServer(payload).catch((error) => {
    console.error("Failed to create server notification", error);
  });

  if (typeof window !== "undefined" && (window as any).refreshNotifications) {
    (window as any).refreshNotifications();
  }

  return localNotification;
}

export async function loadNotifications(
  tenantId?: string,
  unreadOnly?: boolean,
): Promise<NotificationRecord[]> {
  try {
    const serverNotifications = await fetchNotificationsFromServer(
      tenantId,
      unreadOnly,
    );
    if (serverNotifications.length > 0) {
      writeNotifications(serverNotifications);
      return tenantId
        ? serverNotifications.filter(
            (notification) => !notification.hiddenFor?.includes(tenantId),
          )
        : serverNotifications;
    }
    return getNotifications(tenantId);
  } catch (error) {
    console.error("Failed to load notifications from server", error);
    return getNotifications(tenantId);
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    const notifications = getStorageNotifications();
    const updated = notifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification,
    );
    writeNotifications(updated);
  } catch (error) {
    console.error("Failed to mark local notification read", error);
  }

  markNotificationReadOnServer(notificationId).catch((error) => {
    console.error("Failed to mark notification read on server", error);
  });
}

export async function markMessageNotificationRead(
  messageId: string,
  token?: string | null,
): Promise<void> {
  if (!messageId) return;

  try {
    const notifications = getNotifications();
    const match = notifications.find(
      (notification) =>
        notification.resourceType === "message" &&
        notification.resourceId === messageId &&
        !notification.read,
    );

    if (match) {
      await markAsRead(match.id);
      return;
    }

    // Attempt to mark the server notification read by matching resourceType/resourceId.
    const serverNotifications = await fetchNotificationsFromServer(
      undefined,
      undefined,
      undefined,
      token,
    );
    const serverMatch = serverNotifications.find(
      (notification) =>
        notification.resourceType === "message" &&
        notification.resourceId === messageId &&
        !notification.read,
    );

    if (serverMatch) {
      await markNotificationReadOnServer(serverMatch.id, token);
    }
  } catch (error) {
    console.error("Failed to mark message notification read", error);
  }
}

export async function hideNotification(
  notificationId: string,
  tenantId: string,
): Promise<void> {
  try {
    const notifications = getStorageNotifications();
    const updated = notifications.map((notification) => {
      if (notification.id !== notificationId) return notification;
      const hiddenFor = Array.isArray(notification.hiddenFor)
        ? notification.hiddenFor
        : [];
      return {
        ...notification,
        hiddenFor: hiddenFor.includes(tenantId)
          ? hiddenFor
          : [...hiddenFor, tenantId],
      };
    });
    writeNotifications(updated);
  } catch (error) {
    console.error("Failed to hide local notification", error);
  }

  hideNotificationOnServer(notificationId, tenantId).catch((error) => {
    console.error("Failed to hide notification on server", error);
  });
}

export async function deleteNotification(
  notificationId: string,
): Promise<void> {
  try {
    const notifications = getNotifications().filter(
      (notification) => notification.id !== notificationId,
    );
    writeNotifications(notifications);
  } catch (error) {
    console.error("Failed to delete local notification", error);
  }

  deleteNotificationOnServer(notificationId).catch((error) => {
    console.error("Failed to delete notification on server", error);
  });
}

export function getUnreadCount(tenantId?: string): number {
  return getNotifications(tenantId).filter((notification) => !notification.read)
    .length;
}

export function notifyNewProperty(
  propertyName: string,
  propertyId: string,
): void {
  createNotification({
    type: "property.created",
    title: "New Property Added",
    body: `Property "${propertyName}" was added to your portfolio.`,
    category: "creation",
    resourceType: "property",
    resourceId: propertyId,
    actionUrl: `/dashboard/properties/${propertyId}`,
    metadata: { propertyName },
  });
}

export function notifyNewMaintenanceRequest(
  description: string,
  propertyName: string,
  requestId: string,
  tenantId?: string,
): void {
  createNotification({
    type: "maintenance.requested",
    title: "New Maintenance Request",
    body: `${description} - ${propertyName}`,
    category: "creation",
    resourceType: "maintenance",
    resourceId: requestId,
    tenantId,
    actionUrl: "/dashboard/maintenance",
    metadata: { propertyName },
  });
}

export function notifyNewMessage(
  senderName: string,
  preview: string,
  messageId?: string,
  tenantId?: string,
): void {
  createNotification({
    type: "message.new",
    title: "New Message Received",
    body: `${senderName}: ${preview}`,
    category: "message",
    resourceType: "message",
    resourceId: messageId,
    tenantId,
    actionUrl: tenantId ? "/tenant/messages" : "/dashboard/communications",
    metadata: { senderName },
  });
}

export function notifyNewTenant(
  tenantName: string,
  propertyName: string,
  tenantId: string,
): void {
  createNotification({
    type: "tenant.created",
    title: "New Tenant Added",
    body: `Tenant "${tenantName}" was added to ${propertyName}.`,
    category: "creation",
    resourceType: "tenant",
    resourceId: tenantId,
    actionUrl: `/dashboard/tenants/${tenantId}`,
    metadata: { tenantName, propertyName },
  });
}

export function notifyTenantProfileUpdated(
  tenantId: string,
  changedFields: string[],
): void {
  createNotification({
    type: "tenant.profile.updated",
    title: "Tenant Profile Updated",
    body: `Profile update fields: ${changedFields.join(", ")}`,
    category: "update",
    resourceType: "tenant",
    resourceId: tenantId,
    actionUrl: `/dashboard/tenants/${tenantId}`,
    metadata: { changedFields },
  });
}

export function notifyTenantProfileUpdateToAdmin(
  tenantName: string,
  changedFields: string[],
): void {
  createNotification({
    type: "tenant.profile.updated",
    title: "Tenant Updated Their Profile",
    body: `Tenant ${tenantName} updated: ${changedFields.join(", ")}`,
    category: "update",
    resourceType: "tenant",
    actionUrl: "/dashboard/tenants",
    metadata: { changedFields },
  });
}

export function notifyPropertyUpdated(
  propertyName: string,
  propertyId: string,
  changedFields: string[],
  targetTenantIds?: string[],
): void {
  createNotification({
    type: "property.updated",
    title: "Property Updated",
    body: `Changes: ${changedFields.join(", ")}`,
    category: "update",
    resourceType: "property",
    resourceId: propertyId,
    targetTenantIds,
    actionUrl: `/tenant/property/${propertyId}`,
    metadata: { propertyName, changedFields },
  });
}

export function notifyPaymentMade(
  tenantId: string,
  amount: number,
  balance?: number,
  paymentId?: string,
): void {
  createNotification({
    type: "payment.received",
    title: "Payment Received",
    body: `A payment of ${amount} was processed.${
      balance !== undefined ? ` Balance: ${balance}.` : ""
    }`,
    category: "payment",
    resourceType: "payment",
    resourceId: paymentId,
    tenantId,
    actionUrl: tenantId ? "/tenant/payments" : "/dashboard/finances",
    metadata: { amount, balance },
  });
}

export function notifySystemChange(
  title: string,
  body: string,
  resourceId?: string,
  actionUrl?: string,
): void {
  createNotification({
    type: "system.change",
    title,
    body,
    category: "sys",
    resourceType: "settings",
    resourceId,
    actionUrl,
  });
}
