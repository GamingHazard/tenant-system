import { migrateDatabase } from "@/lib/migrations";
import {
  deriveAesGcmKeyFromSecret,
  decryptString,
  encryptString,
} from "@/lib/crypto";

const DB_KEY = "propman:v1";

export interface SystemSettings {
  id: string;
  version: string;
  companyInfo?: {
    name?: string;
    address?: {
      address?: string;
      estate?: string;
      city?: string;
      country?: string;
    };
    phone?: string;
    email?: string;
    logo?: {
      url?: string;
      public_id?: string;
    };
    licenseNumber?: string;
  };
  propertyTypeDefaults: {
    [propertyType: string]: {
      requiredFields: string[];
      optionalFields: string[];
      defaultLeaseTerms: {
        duration: string;
        renewal: string;
        noticePeriod: string;
      };
      financialRules: {
        securityDeposit: string;
        lateFee: string;
        gracePeriod: string;
      };
      validationRules: Record<string, any>;
    };
  };
  tenantTypeConfigurations: {
    [tenantType: string]: {
      requiredFields: string[];
      optionalFields?: string[];
      validationRules: Record<string, any>;
      defaultSettings: {
        preferredContactMethod: "email" | "phone" | "sms";
        applicationFee: number;
        screeningRequirements?: string[];
      };
    };
  };
  complianceSettings: {
    [jurisdiction: string]: {
      commercialRequirements: string[];
      residentialRequirements: string[];
      reportingRequirements: {
        frequency: string;
        includeFinancials: boolean;
        includeOccupancy: boolean;
      };
    };
  };
  notifications?: {
    templates: Record<
      string,
      {
        subject: string;
        body: string;
        channels: Array<"email" | "sms" | "in_app" | "portal">;
      }
    >;
    schedules: Record<
      string,
      {
        enabled: boolean;
        timing: string;
        conditions: string[];
      }
    >;
  };
  emailSettings?: {
    provider?: "smtp" | "sendgrid" | "mailgun";
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    enableEmailNotifications?: boolean;
    enableInviteEmails?: boolean;
    enableWelcomeEmails?: boolean;
    enablePasswordResetEmails?: boolean;
  };
  tenantPortalSettings?: Partial<TenantPortalSettings>;
  systemFeatures?: {
    map?: boolean;
    messaging?: boolean;
    analytics?: boolean;
    reporting?: boolean;
    auditing?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  lastMigrationDate?: string;
}

export interface TenantPortalSettings {
  portalUrl?: string;
  enabledFeatures?: Record<string, boolean>;
  invitationExpirationDays?: number;
  allowDocumentUploads?: boolean;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    smsProvider?: string;
    emailTemplate?: string;
  };
  paymentSettings: {
    enableAutopay: boolean;
    autopayThreshold?: number;
    acceptedMethods: Array<{
      type: string;
      enabled: boolean;
      processingFee: number;
    }>;
    paymentProviders: Array<{
      name: string;
      apiKey?: string;
      config?: Record<string, any>;
    }>;
  };
  documentAccess: {
    allowUploads: boolean;
    maxFileSize?: number;
    allowedFileTypes: string[];
    requireApproval: boolean;
    retentionDays?: number;
  };
  maintenancePreferences: {
    enableRequests: boolean;
    requireTenantApproval?: boolean;
    estimatedResponseTime?: number;
    allowEmergencyAfterHours: boolean;
    priorityLevels: Array<{
      name: string;
      responseTime: number;
    }>;
  };
  featureToggles: {
    paymentPortal: boolean;
    maintenanceRequests: boolean;
    documentAccess: boolean;
    messages: boolean;
    announcements: boolean;
    leaseInfo: boolean;
    evictionNotice?: boolean;
  };
  communicationPreferences: {
    preferredContactMethod: "email" | "sms" | "in-app";
    languages: string[];
    timezone?: string;
    doNotDisturb?: {
      enabled?: boolean;
      startTime?: string;
      endTime?: string;
    };
  };
  financeSettings?: {
    currency: string;
    paymentMethods: Array<{
      type: string;
      enabled: boolean;
      processingFee: number;
    }>;
  };
  securitySettings: {
    allowPasswordChange: boolean;
    autoLogoutEnabled?: boolean;
    autoLogoutInactivityMinutes?: number;
    allowAccountDeletion: boolean;
    requirePasswordReset?: boolean;
    passwordExpirationDays?: number;
    allowProfileEditing?: boolean;
    autoLockEnabled?: boolean;
    failedLoginThreshold?: number;
  };
}

export type CollectionName =
  | "users"
  | "properties"
  | "tenants"
  | "payments"
  | "messages"
  | "replies"
  | "announcements"
  | "transactions"
  | "maintenance"
  | "notifications"
  | "documents"
  | "server:notifications"
  | "settings"
  | "system-settings"
  | "invites"
  | "auditLogs"
  | "visits";

export interface DBSchema {
  version: string;
  users: any[];
  properties: any[];
  tenants: any[];
  payments: any[];
  messages: any[];
  replies: any[];
  announcements: any[];
  transactions: any[];
  maintenance: any[];
  notifications: any[];
  documents: any[];
  "server:notifications": any[];
  settings: SystemSettings[];
  "system-settings": SystemSettings[];
  invites: any[];
  auditLogs: any[];
  visits: any[];
}

const CURRENT_VERSION = "2.1.0";

const defaultDB: DBSchema = {
  version: CURRENT_VERSION,
  users: [],
  properties: [],
  tenants: [],
  payments: [],
  messages: [],
  replies: [],
  announcements: [],
  transactions: [],
  maintenance: [],
  notifications: [],
  documents: [],
  "server:notifications": [],
  settings: [],
  "system-settings": [],
  invites: [],
  auditLogs: [],
  visits: [],
};

declare global {
  var __PROP_MAN_DB__: DBSchema | undefined;
}

function getServerDatabase(): DBSchema {
  const globalAny = globalThis as typeof globalThis & {
    __PROP_MAN_DB__?: DBSchema;
  };
  if (!globalAny.__PROP_MAN_DB__) {
    globalAny.__PROP_MAN_DB__ = { ...defaultDB };
  }
  return globalAny.__PROP_MAN_DB__ as DBSchema;
}

const ENCRYPTION_PREFIX = "enc:";
let encryptionKey: CryptoKey | null = null;
let cachedDb: DBSchema | null = null;
let encryptionInitialized = false;

async function writeEncryptedRaw(db: DBSchema) {
  if (typeof window === "undefined" || !encryptionKey) return;

  try {
    const encrypted = await encryptString(encryptionKey, JSON.stringify(db));
    localStorage.setItem(DB_KEY, `${ENCRYPTION_PREFIX}${encrypted}`);
  } catch (error) {
    console.error("local-store encrypted write error", error);
  }
}

async function loadCachedDatabase() {
  if (typeof window === "undefined" || !encryptionKey) return;

  const txt = localStorage.getItem(DB_KEY);
  if (!txt) {
    cachedDb = defaultDB;
    return;
  }

  try {
    if (txt.startsWith(ENCRYPTION_PREFIX)) {
      const decrypted = await decryptString(
        encryptionKey,
        txt.slice(ENCRYPTION_PREFIX.length),
      );
      cachedDb = { ...defaultDB, ...JSON.parse(decrypted) };
      return;
    }

    cachedDb = { ...defaultDB, ...JSON.parse(txt) };
    await writeEncryptedRaw(cachedDb);
  } catch (error) {
    console.warn(
      "local-store encrypted cache load error — clearing invalid payload",
    );
    try {
      // If the stored value was an encrypted payload that failed to decrypt,
      // remove it to avoid repeated failures on subsequent init attempts.
      const raw = localStorage.getItem(DB_KEY);
      if (raw && raw.startsWith(ENCRYPTION_PREFIX)) {
        localStorage.removeItem(DB_KEY);
        console.warn(
          "local-store: removed invalid encrypted payload from storage",
        );
      }
    } catch (e) {
      console.warn("local-store: failed to clean invalid encrypted payload", e);
    }

    cachedDb = defaultDB;
  }
}

export async function setStorageEncryptionKey(secret: string) {
  if (typeof window === "undefined") return;

  try {
    encryptionKey = await deriveAesGcmKeyFromSecret(secret);
    encryptionInitialized = true;
    await loadCachedDatabase();
  } catch (error) {
    console.error("Failed to initialize local storage encryption", error);
  }
}

export function clearStorageEncryptionKey() {
  encryptionKey = null;
  cachedDb = null;
  encryptionInitialized = false;
}

export function isStorageEncryptionEnabled() {
  return encryptionInitialized;
}

function readRaw(): DBSchema {
  if (typeof window === "undefined") {
    return getServerDatabase();
  }

  if (cachedDb) {
    return cachedDb;
  }

  try {
    const txt = localStorage.getItem(DB_KEY);
    if (!txt) return defaultDB;
    if (txt.startsWith(ENCRYPTION_PREFIX)) {
      return cachedDb ?? defaultDB;
    }

    const parsed = JSON.parse(txt);
    const dbWithDefaults = { ...defaultDB, ...parsed };

    // Apply migrations if needed
    const migratedDb = migrateDatabase(dbWithDefaults);

    // Save migrated database back to localStorage
    if (migratedDb.version !== dbWithDefaults.version) {
      writeRaw(migratedDb);
    }

    return migratedDb;
  } catch (e) {
    console.error("local-store read error", e);
    return defaultDB;
  }
}

function writeRaw(db: DBSchema) {
  if (typeof window === "undefined") {
    const globalAny = globalThis as typeof globalThis & {
      __PROP_MAN_DB__?: DBSchema;
    };
    globalAny.__PROP_MAN_DB__ = db;
    return;
  }

  if (encryptionKey) {
    cachedDb = db;
    void writeEncryptedRaw(db);
    return;
  }

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error("local-store write error", e);
  }
}

export function clearDB() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DB_KEY);
}

export function getCollection<T = any>(name: CollectionName): T[] {
  const db = readRaw();
  return (db as any)[name] as T[];
}

export function findInCollection<T = any>(
  name: CollectionName,
  predicate: (item: T) => boolean,
): T | null {
  const col = getCollection<T>(name);
  return col.find(predicate) ?? null;
}

export function insertIntoCollection<T = any>(
  name: CollectionName,
  item: T,
): T {
  const db = readRaw();
  const col = (db as any)[name] as T[];
  col.push(item);
  writeRaw(db);
  return item;
}

export function updateInCollection<T = any>(
  name: CollectionName,
  id: string,
  patch: Partial<T>,
): T | null {
  const db = readRaw();
  const col = (db as any)[name] as any[];
  const idx = col.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  col[idx] = { ...col[idx], ...patch };
  writeRaw(db);
  return col[idx];
}

export function removeFromCollection(
  name: CollectionName,
  id: string,
): boolean {
  const db = readRaw();
  const col = (db as any)[name] as any[];
  const idx = col.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  col.splice(idx, 1);
  writeRaw(db);
  return true;
}

export function writeCollection<T = any>(
  name: CollectionName,
  items: T[],
): void {
  const db = readRaw();
  (db as any)[name] = items;
  writeRaw(db);
}

export function generateId(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}-${t}${r}` : `${t}${r}`;
}

export function setValue<T = any>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("local-store setValue error", e);
  }
}

export function getValue<T = any>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const txt = localStorage.getItem(key);
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch (e) {
    console.error("local-store getValue error", e);
    return null;
  }
}

export function removeValue(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("local-store removeValue error", e);
  }
}
