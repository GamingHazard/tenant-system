import { apiRequest } from "@/lib/query-client";
import {
  insertIntoCollection,
  getCollection,
  updateInCollection,
  generateId,
  removeFromCollection,
} from "@/lib/local-store";
import { SystemSettings } from "@/lib/local-store";
import { getCurrentUser } from "@/lib/services/auth";

function normalizeSettingsResponse<T = any>(raw: any): T | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "object") {
    if (raw.success === true) {
      return raw.data !== undefined ? raw.data : raw;
    }
    if (raw.settings !== undefined) {
      return raw.settings;
    }
    if (raw.data !== undefined) {
      return raw.data;
    }
  }
  return raw as T;
}

export interface CompanyAddress {
  address?: string;
  estate?: string;
  street?: string;
  city?: string;
  country?: string;
}

export interface CompanyLogo {
  url?: string;
  public_id?: string;
}

export interface CompanyInfo {
  name?: string;
  address?: CompanyAddress;
  phone?: string;
  email?: string;
  logo?: CompanyLogo;
  licenseNumber?: string;
}

export interface PropertyLeaseTerms {
  duration: string;
  renewal: string;
  noticePeriod: string;
}

export interface PropertyFinancialRules {
  securityDeposit: string;
  lateFee: string;
  gracePeriod: string;
}

export interface PropertyTypeDefaults {
  requiredFields: string[];
  optionalFields: string[];
  defaultLeaseTerms: PropertyLeaseTerms;
  financialRules: PropertyFinancialRules;
  validationRules: Record<string, any>;
}

export interface TenantTypeConfiguration {
  requiredFields: string[];
  optionalFields?: string[];
  validationRules: Record<string, any>;
  defaultSettings: {
    preferredContactMethod: "email" | "phone" | "sms";
    applicationFee: number;
    screeningRequirements?: string[];
  };
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  channels: Array<"email" | "sms" | "in_app" | "portal">;
}

export interface NotificationSchedule {
  enabled: boolean;
  timing: string;
  conditions: string[];
}

export interface NotificationsConfig {
  templates: Record<string, NotificationTemplate>;
  schedules: Record<string, NotificationSchedule>;
}

// Tenant Portal Settings Interfaces
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  smsProvider?: string;
  emailTemplate?: string;
}

// Admin Payment Method Configuration
export type PaymentMethodType =
  | "MTN_MoMo"
  | "Airtel_Money"
  | "M-Pesa"
  | "Orange_Money"
  | "Visa_Mastercard"
  | "Bank_Transfer";

export interface BankDetails {
  accountHolder?: string;
  accountNumber?: string;
  bankName?: string;
  swiftCode?: string;
  routingNumber?: string;
}

export interface MpesaDetails {
  shortcode?: string;
  consumerKey?: string;
  // secrets are stored encrypted on the server; UI will treat these as masked values
  consumerSecret?: string;
  passkey?: string;
  environment?: "sandbox" | "production";
  is_active?: boolean;
}

export interface AdminPaymentMethod {
  _id?: string;
  type: PaymentMethodType;
  enabled: boolean;
  transactionNumber?: string;
  bankDetails?: BankDetails;
  mpesa?: MpesaDetails;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentMethod {
  type: string;
  enabled: boolean;
  processingFee: number;
}

export interface PaymentProvider {
  name: string;
  apiKey?: string;
  config?: Record<string, any>;
}

export interface PaymentSettings {
  enableAutopay: boolean;
  autopayThreshold?: number;
  acceptedMethods: PaymentMethod[];
  paymentProviders: PaymentProvider[];
}

export interface DocumentAccess {
  allowUploads: boolean;
  maxFileSize?: number;
  allowedFileTypes: string[];
  requireApproval: boolean;
  retentionDays?: number;
}

export interface PriorityLevel {
  name: string;
  responseTime: number;
}

export interface MaintenancePreferences {
  enableRequests: boolean;
  requireTenantApproval?: boolean;
  estimatedResponseTime?: number;
  allowEmergencyAfterHours: boolean;
  priorityLevels: PriorityLevel[];
}

export interface FeatureToggles {
  paymentPortal: boolean;
  maintenanceRequests: boolean;
  documentAccess: boolean;
  messages: boolean;
  evictionNotice?: boolean;
}

export interface FinanceSettings {
  currency: string;
  paymentMethods: PaymentMethod[];
}

export interface SystemFeatureToggles {
  map: boolean;
  messaging: boolean;
  analytics: boolean;
  reporting: boolean;
  auditing: boolean;
}

export interface DoNotDisturb {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
}

export interface CommunicationPreferences {
  preferredContactMethod: "email" | "sms" | "in-app";
  languages: string[];
  timezone?: string;
  doNotDisturb?: DoNotDisturb;
}

export interface SecuritySettings {
  allowPasswordChange: boolean;
  autoLogoutEnabled?: boolean;
  autoLogoutInactivityMinutes?: number;
  allowAccountDeletion: boolean;
  requirePasswordReset?: boolean;
  passwordExpirationDays?: number;
  allowProfileEditing?: boolean;
  autoLockEnabled?: boolean;
  failedLoginThreshold?: number;
}

export interface TenantPortalSettings {
  notificationPreferences: NotificationPreferences | any;
  paymentSettings: PaymentSettings | any;
  documentAccess: DocumentAccess | any;
  maintenancePreferences: MaintenancePreferences | any;
  featureToggles: FeatureToggles | any;
  communicationPreferences: CommunicationPreferences | any;
  securitySettings: SecuritySettings | any;
  financeSettings?: FinanceSettings | any;
}

const defaultTenantPortalSettings: TenantPortalSettings = {
  notificationPreferences: {
    email: true,
    sms: false,
    inApp: true,
    smsProvider: "",
    emailTemplate: "",
  },
  paymentSettings: {
    enableAutopay: false,
    autopayThreshold: 0,
    acceptedMethods: [
      { type: "credit_card", enabled: false, processingFee: 2.9 },
      { type: "bank_transfer", enabled: false, processingFee: 0.5 },
      { type: "mpesa", enabled: false, processingFee: 0.5 },
      { type: "mobile money", enabled: false, processingFee: 0.5 },
    ],
    paymentProviders: [],
  },
  documentAccess: {
    allowUploads: true,
    maxFileSize: 10485760,
    allowedFileTypes: ["pdf", "doc", "docx", "jpg", "png"],
    requireApproval: false,
    retentionDays: 365,
  },
  maintenancePreferences: {
    enableRequests: true,
    requireTenantApproval: false,
    estimatedResponseTime: 48,
    allowEmergencyAfterHours: true,
    priorityLevels: [
      { name: "Low", responseTime: 7 },
      { name: "Medium", responseTime: 72 },
      { name: "High", responseTime: 24 },
      { name: "Emergency", responseTime: 2 },
    ],
  },
  featureToggles: {
    paymentPortal: true,
    maintenanceRequests: true,
    documentAccess: true,
    messages: true,
    evictionNotice: false,
  },
  communicationPreferences: {
    preferredContactMethod: "email",
    languages: ["en"],
    timezone: "UTC",
    doNotDisturb: {
      enabled: false,
      startTime: "",
      endTime: "",
    },
  },
  securitySettings: {
    allowPasswordChange: true,
    autoLogoutInactivityMinutes: 30,
    allowAccountDeletion: false,
    allowProfileEditing: true,
    autoLockEnabled: false,
    failedLoginThreshold: 5,
    requirePasswordReset: false,
    passwordExpirationDays: 90,
  },
  financeSettings: {
    currency: "USD",
    paymentMethods: [
      { type: "credit_card", enabled: false, processingFee: 2.9 },
      { type: "bank_transfer", enabled: false, processingFee: 0.5 },
      { type: "mpesa", enabled: false, processingFee: 0.5 },
      { type: "mobile_money", enabled: false, processingFee: 0.5 },
    ],
  },
};

function ensureTenantPortalSettings(settings: SystemSettings): SystemSettings {
  const existing: Partial<TenantPortalSettings> =
    settings.tenantPortalSettings || {};

  const normalized: TenantPortalSettings = {
    notificationPreferences: {
      ...defaultTenantPortalSettings.notificationPreferences,
      ...existing.notificationPreferences,
    },
    paymentSettings: {
      ...defaultTenantPortalSettings.paymentSettings,
      ...existing.paymentSettings,
      acceptedMethods:
        existing.paymentSettings?.acceptedMethods ||
        defaultTenantPortalSettings.paymentSettings.acceptedMethods,
      paymentProviders:
        existing.paymentSettings?.paymentProviders ||
        defaultTenantPortalSettings.paymentSettings.paymentProviders,
    },
    documentAccess: {
      ...defaultTenantPortalSettings.documentAccess,
      ...existing.documentAccess,
    },
    maintenancePreferences: {
      ...defaultTenantPortalSettings.maintenancePreferences,
      ...existing.maintenancePreferences,
      priorityLevels:
        existing.maintenancePreferences?.priorityLevels ||
        defaultTenantPortalSettings.maintenancePreferences.priorityLevels,
    },
    featureToggles: {
      ...defaultTenantPortalSettings.featureToggles,
      ...existing.featureToggles,
    },
    communicationPreferences: {
      ...defaultTenantPortalSettings.communicationPreferences,
      ...existing.communicationPreferences,
      doNotDisturb: {
        ...defaultTenantPortalSettings.communicationPreferences.doNotDisturb,
        ...existing.communicationPreferences?.doNotDisturb,
      },
    },
    securitySettings: {
      ...defaultTenantPortalSettings.securitySettings,
      ...existing.securitySettings,
    },
    financeSettings: {
      ...defaultTenantPortalSettings.financeSettings,
      ...existing.financeSettings,
      paymentMethods:
        existing.financeSettings?.paymentMethods ||
        defaultTenantPortalSettings.financeSettings.paymentMethods,
    },
  };

  return {
    ...settings,
    tenantPortalSettings: normalized,
  };
}

export function getSystemSettings(): SystemSettings | null {
  const settings = getCollection<SystemSettings>("system-settings");
  return settings.length > 0 ? ensureTenantPortalSettings(settings[0]) : null;
}

/**
 * Load settings from API for a specific user (by settingsId)
 * Used when admin has their own settings record linked to their user account
 */
export async function getAdminSettingsByUserId(
  userId?: string,
): Promise<SettingsPayload | null> {
  if (!userId) {
    return await fetchSettingsFromApi(); // Fall back to default (authenticated user's settings)
  }

  // Get the user to access their settingsId
  const user = (await getCurrentUser()) as any;
  if (!user?.settingsId) {
    // User doesn't have a linked settings record, use default
    return await fetchSettingsFromApi();
  }

  // Fetch the user's specific settings by settingsId
  return await fetchSettingsByIdFromApi(user.settingsId);
}

export function createDefaultSystemSettings(): SystemSettings {
  const defaultSettings: SystemSettings = {
    id: generateId("settings"),
    version: "2.0.0",
    propertyTypeDefaults: {
      residential: {
        requiredFields: [
          "name",
          "address",
          "city",
          "country",
          "units_available",
          "price_per_unit",
        ],
        optionalFields: [
          "bedrooms",
          "bathrooms",
          "petPolicy",
          "residentialFeatures",
          "description",
        ],
        defaultLeaseTerms: {
          duration: "12 months",
          renewal: "automatic",
          noticePeriod: "30 days",
        },
        financialRules: {
          securityDeposit: "one month rent",
          lateFee: "50",
          gracePeriod: "5 days",
        },
        validationRules: {
          minRent: 500,
          maxRent: 10000,
        },
      },
      commercial: {
        requiredFields: [
          "name",
          "address",
          "city",
          "country",
          "units_available",
          "price_per_unit",
          "propertyType",
        ],
        optionalFields: [
          "zoning",
          "permittedUses",
          "loadingDocks",
          "ceilingHeight",
          "powerCapacity",
          "commercialFeatures",
          "annualPropertyTaxes",
          "annualInsurance",
          "appraisedValue",
          "noi",
          "capRate",
        ],
        defaultLeaseTerms: {
          duration: "36 months",
          renewal: "negotiated",
          noticePeriod: "90 days",
        },
        financialRules: {
          securityDeposit: "two months rent",
          lateFee: "100",
          gracePeriod: "10 days",
        },
        validationRules: {
          minRent: 1000,
          maxRent: 50000,
        },
      },
      mixed_use: {
        requiredFields: [
          "name",
          "address",
          "city",
          "country",
          "units_available",
          "price_per_unit",
          "propertyType",
        ],
        optionalFields: [
          "zoning",
          "permittedUses",
          "residentialFeatures",
          "commercialFeatures",
          "annualPropertyTaxes",
          "annualInsurance",
        ],
        defaultLeaseTerms: {
          duration: "24 months",
          renewal: "negotiated",
          noticePeriod: "60 days",
        },
        financialRules: {
          securityDeposit: "one and half months rent",
          lateFee: "75",
          gracePeriod: "7 days",
        },
        validationRules: {
          minRent: 750,
          maxRent: 25000,
        },
      },
    },
    tenantTypeConfigurations: {
      residential: {
        requiredFields: [
          "name",
          "email",
          "phone",
          "leaseStartDate",
          "monthlyRent",
        ],
        validationRules: {
          minAge: 18,
          maxOccupants: 6,
          creditCheck: "required",
        },
        defaultSettings: {
          preferredContactMethod: "email",
          applicationFee: 50,
        },
      },
      commercial: {
        requiredFields: [
          "name",
          "email",
          "phone",
          "businessInfo",
          "leaseStartDate",
          "monthlyRent",
        ],
        validationRules: {
          businessLicense: "required",
          financialStatements: "required",
          references: "required",
        },
        defaultSettings: {
          preferredContactMethod: "email",
          applicationFee: 100,
        },
      },
      mixed: {
        requiredFields: [
          "name",
          "email",
          "phone",
          "leaseStartDate",
          "monthlyRent",
        ],
        validationRules: {
          minAge: 18,
          businessLicense: "optional",
          creditCheck: "required",
        },
        defaultSettings: {
          preferredContactMethod: "email",
          applicationFee: 75,
        },
      },
    },
    complianceSettings: {
      default: {
        commercialRequirements: [
          "business_license",
          "insurance_certificate",
          "financial_statements",
        ],
        residentialRequirements: [
          "identification",
          "income_verification",
          "rental_history",
        ],
        reportingRequirements: {
          frequency: "monthly",
          includeFinancials: true,
          includeOccupancy: true,
        },
      },
    },
    notifications: {
      templates: {
        rentDue: {
          subject: "Rent payment reminder",
          body: "Your rent payment is due soon. Please pay on time to avoid late fees.",
          channels: ["email", "in_app"],
        },
        messages: {
          subject: "New message received",
          body: "You have a new message waiting in your tenant portal.",
          channels: ["email", "in_app"],
        },
        failedLogin: {
          subject: "Failed login attempt",
          body: "A failed login attempt was detected. Please verify your account activity.",
          channels: ["email", "in_app"],
        },
        rentPayments: {
          subject: "Rent payment status",
          body: "A rent payment has been received or failed. Please review the details.",
          channels: ["email", "in_app"],
        },
        tenantProfile: {
          subject: "Tenant profile updated",
          body: "A tenant profile has been created, updated, or deleted.",
          channels: ["email", "in_app"],
        },
        propertyProfile: {
          subject: "Property profile updated",
          body: "A property profile has been created, updated, or deleted.",
          channels: ["email", "in_app"],
        },
        maintenance: {
          subject: "Maintenance update",
          body: "A maintenance request has been created or updated.",
          channels: ["email", "in_app"],
        },
        expenses: {
          subject: "Expense record updated",
          body: "An expense record has been created or updated.",
          channels: ["email", "in_app"],
        },
      },
      schedules: {
        dailySummary: {
          enabled: true,
          timing: "08:00",
          conditions: ["overdue", "pending_requests"],
        },
        monthlyStatement: {
          enabled: true,
          timing: "01:00",
          conditions: ["payment_history"],
        },
      },
    },
    emailSettings: {
      provider: "smtp",
      host: "smtp.gmail.com",
      port: 587,
      user: "",
      password: "",
      enableEmailNotifications: true,
      enableInviteEmails: true,
      enableWelcomeEmails: true,
      enablePasswordResetEmails: true,
    },
    tenantPortalSettings: {
      notificationPreferences: {
        email: true,
        sms: false,
        inApp: true,
        smsProvider: "",
        emailTemplate: "",
      },
      paymentSettings: {
        enableAutopay: false,
        autopayThreshold: 0,
        acceptedMethods: [
          { type: "credit_card", enabled: true, processingFee: 2.9 },
          { type: "bank_transfer", enabled: true, processingFee: 0.5 },
        ],
        paymentProviders: [],
      },
      documentAccess: {
        allowUploads: true,
        maxFileSize: 10485760,
        allowedFileTypes: ["pdf", "doc", "docx", "jpg", "png"],
        requireApproval: false,
        retentionDays: 365,
      },
      maintenancePreferences: {
        enableRequests: true,
        requireTenantApproval: false,
        estimatedResponseTime: 48,
        allowEmergencyAfterHours: true,
        priorityLevels: [
          { name: "Low", responseTime: 7 },
          { name: "Medium", responseTime: 72 },
          { name: "High", responseTime: 24 },
          { name: "Emergency", responseTime: 2 },
        ],
      },
      featureToggles: {
        paymentPortal: true,
        maintenanceRequests: true,
        documentAccess: true,
        messages: true,
        announcements: true,
        leaseInfo: true,
      },
      communicationPreferences: {
        preferredContactMethod: "email",
        languages: ["en"],
        timezone: "UTC",
        doNotDisturb: {
          enabled: false,
          startTime: "",
          endTime: "",
        },
      },
      securitySettings: {
        allowPasswordChange: true,
        autoLogoutEnabled: true,
        autoLogoutInactivityMinutes: 30,
        allowAccountDeletion: false,
        requirePasswordReset: false,
        passwordExpirationDays: 90,
      },
    },
    companyInfo: {
      name: "Tenant Manager",
      address: {
        address: "123 Main St",
        estate: "",
        city: "Nairobi",
        country: "Kenya",
      },
      phone: "+1 (555) 123-4567",
      email: "support@tenantmanager.com",
      logo: {
        url: "",
        public_id: "",
      },
      licenseNumber: "",
    },
    systemFeatures: {
      map: true,
      messaging: true,
      analytics: false,
      reporting: true,
      auditing: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMigrationDate: new Date().toISOString(),
  };

  return insertIntoCollection("system-settings", defaultSettings);
}

export function updateSystemSettings(
  updates: Partial<SystemSettings>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings) return null;

  return updateInCollection("system-settings", settings.id, updates);
}

export function deleteSystemSettings(id: string): boolean {
  return removeFromCollection("system-settings", id);
}

export function getPropertyTypeConfig(propertyType: string): any {
  const settings = getSystemSettings();
  return (
    settings?.propertyTypeDefaults[propertyType] ||
    settings?.propertyTypeDefaults.residential
  );
}

export function getTenantTypeConfig(tenantType: string): any {
  const settings = getSystemSettings();
  return (
    settings?.tenantTypeConfigurations[tenantType] ||
    settings?.tenantTypeConfigurations.residential
  );
}

export function initializeSystemSettings(): SystemSettings {
  let settings = getSystemSettings();
  if (!settings) {
    settings = createDefaultSystemSettings();
  }
  return settings;
}

// Tenant Portal Settings Helpers
export function getTenantPortalSettings(): TenantPortalSettings | null {
  const settings = getSystemSettings();
  return (settings?.tenantPortalSettings ||
    null) as TenantPortalSettings | null;
}

export function updateTenantPortalSettings(
  updates: Partial<TenantPortalSettings>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings) return null;

  const updated = {
    tenantPortalSettings: {
      ...settings.tenantPortalSettings,
      ...updates,
    },
  };

  return updateSystemSettings(updated);
}

export function updateTenantPortalNotifications(
  updates: Partial<NotificationPreferences>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    notificationPreferences: {
      ...settings.tenantPortalSettings.notificationPreferences,
      ...updates,
    },
  });
}

export function updatePaymentSettings(
  updates: Partial<PaymentSettings>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    paymentSettings: {
      ...settings.tenantPortalSettings.paymentSettings,
      ...updates,
    },
  });
}

export function updateDocumentAccess(
  updates: Partial<DocumentAccess>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    documentAccess: {
      ...settings.tenantPortalSettings.documentAccess,
      ...updates,
    },
  });
}

export function updateMaintenancePreferences(
  updates: Partial<MaintenancePreferences>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    maintenancePreferences: {
      ...settings.tenantPortalSettings.maintenancePreferences,
      ...updates,
    },
  });
}

export function updateFeatureToggles(
  updates: Partial<FeatureToggles>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    featureToggles: {
      ...settings.tenantPortalSettings.featureToggles,
      ...updates,
    },
  });
}

export function updateCommunicationPreferences(
  updates: Partial<CommunicationPreferences>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    communicationPreferences: {
      ...settings.tenantPortalSettings.communicationPreferences,
      ...updates,
    },
  });
}

export function updateSecuritySettings(
  updates: Partial<SecuritySettings>,
): SystemSettings | null {
  const settings = getSystemSettings();
  if (!settings?.tenantPortalSettings) return null;

  return updateTenantPortalSettings({
    securitySettings: {
      ...settings.tenantPortalSettings.securitySettings,
      ...updates,
    },
  });
}

// ============================================================================
// API Integration - Server Persistence Layer
// ============================================================================

// ============================================================================
// API Payload Types - Nested Schema (v2)
// ============================================================================

export interface SettingsPayload {
  _id?: string;
  ownerId?: string;
  schemaVersion?: number;
  companyInfo?: {
    name?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
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
  tenantPortal?: {
    portalFeatures?: {
      rentPayment?: boolean;
      maintenanceRequests?: boolean;
      documentAccess?: boolean;
      messages?: boolean;
      announcements?: boolean;
      evictionNotice?: boolean;
    };
  };
  finance?: {
    currency?: {
      code?: string;
      country?: string;
      symbol?: string;
    };
    paymentMethods?: AdminPaymentMethod[];
  };
  notifications?: {
    rentDue?: {
      email?: boolean;
      inApp?: boolean;
      sms?: boolean;
    };
    maintenanceRequest?: {
      email?: boolean;
      inApp?: boolean;
      sms?: boolean;
    };
    announcements?: {
      email?: boolean;
      inApp?: boolean;
      sms?: boolean;
    };
    templates?: Record<string, NotificationTemplate>;
    schedules?: Record<string, NotificationSchedule>;
  };
  features?: {
    map?: boolean;
    messaging?: boolean;
    analytics?: boolean;
    reporting?: boolean;
    auditing?: boolean;
  };
  security?: {
    autoLogout?: {
      enabled?: boolean;
      durationMinutes?: number;
    };
    autoLockout?: {
      enabled?: boolean;
      threshold?: number;
    };
    allowProfileEditing?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Legacy flat format (for backwards compatibility during migration)
interface FlatSettingsData {
  ownerId?: string;
  _id?: string;
  companyInfo_name?: string;
  companyInfo_address?: string;
  companyInfo_city?: string;
  companyInfo_country?: string;
  companyInfo_phone?: string;
  companyInfo_email?: string;
  tenantPortalFeatures_rentPayment?: boolean;
  tenantPortalFeatures_maintenanceRequests?: boolean;
  tenantPortalFeatures_documentAccess?: boolean;
  tenantPortalFeatures_messages?: boolean;
  tenantPortalFeatures_announcements?: boolean;
  tenantPortalFeatures_evictionNotice?: boolean;
  financeSettings_currency?: string;
  notificationSettings_emailNotifications?: boolean;
  notificationSettings_smsNotifications?: boolean;
  systemFeatures_map?: boolean;
  systemFeatures_messaging?: boolean;
  systemFeatures_analytics?: boolean;
  systemFeatures_reporting?: boolean;
  systemFeatures_auditing?: boolean;
  tenantPortalSecurity_autoLogoutInactivityMinutes?: number;
  tenantPortalSecurity_allowProfileEditing?: boolean;
  tenantPortalSecurity_autoLockEnabled?: boolean;
  tenantPortalSecurity_failedLoginThreshold?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Convert settings to nested API payload format
 * Used when sending updates to server
 */
export function convertToSettingsPayload(
  settings: Partial<TenantPortalSettings> & any,
): Partial<SettingsPayload> {
  const formatPaymentMethodForPayload = (method: AdminPaymentMethod) => {
    if (!method) return method;
    const { _id, ...rest } = method;
    const hasValidObjectId =
      typeof _id === "string" && /^[0-9a-fA-F]{24}$/.test(_id);
    return hasValidObjectId ? { _id, ...rest } : rest;
  };

  return {
    companyInfo: {
      name: settings.companyInfo?.name,
      address: settings.companyInfo?.address,
      phone: settings.companyInfo?.phone,
      email: settings.companyInfo?.email,
      logo: settings.companyInfo?.logo,
      licenseNumber: settings.companyInfo?.licenseNumber,
    },
    tenantPortal: {
      portalFeatures: {
        rentPayment: settings.featureToggles?.paymentPortal,
        maintenanceRequests: settings.featureToggles?.maintenanceRequests,
        documentAccess: settings.featureToggles?.documentAccess,
        messages: settings.featureToggles?.messages,
        announcements: settings.featureToggles?.announcements,
        evictionNotice: settings.featureToggles?.evictionNotice,
      },
    },
    finance: {
      currency: {
        code: settings.financeSettings?.currency || "USD",
      },
      paymentMethods: settings.financeSettings?.paymentMethods?.map(
        formatPaymentMethodForPayload,
      ),
    },
    notifications: {
      rentDue: {
        email: settings.notificationPreferences?.email ?? true,
        inApp: settings.notificationPreferences?.inApp ?? true,
        sms: settings.notificationPreferences?.sms ?? false,
      },
      maintenanceRequest: {
        email: settings.notificationPreferences?.email ?? true,
        inApp: settings.notificationPreferences?.inApp ?? true,
        sms: settings.notificationPreferences?.sms ?? false,
      },
      announcements: {
        email: settings.notificationPreferences?.email ?? true,
        inApp: settings.notificationPreferences?.inApp ?? true,
        sms: settings.notificationPreferences?.sms ?? false,
      },
    },
    features: {
      map: settings.systemFeatures?.map ?? true,
      messaging: settings.systemFeatures?.messaging ?? true,
      analytics: settings.systemFeatures?.analytics ?? false,
      reporting: settings.systemFeatures?.reporting ?? true,
      auditing: settings.systemFeatures?.auditing ?? false,
    },
    security: {
      autoLogout: {
        enabled:
          settings.securitySettings?.autoLogoutEnabled ??
          settings.securitySettings?.autoLogoutInactivityMinutes !== undefined,
        durationMinutes:
          settings.securitySettings?.autoLogoutInactivityMinutes ?? 30,
      },
      autoLockout: {
        enabled: settings.securitySettings?.autoLockEnabled ?? false,
        threshold: settings.securitySettings?.failedLoginThreshold ?? 5,
      },
      allowProfileEditing:
        settings.securitySettings?.allowProfileEditing ?? true,
    },
  };
}

/**
 * Convert API nested payload to internal TenantPortalSettings format
 * The API now returns nested structure, this ensures compatibility with UI components
 */
export function convertPayloadToTenantPortalSettings(
  payload: SettingsPayload,
): TenantPortalSettings {
  return {
    notificationPreferences: {
      email: payload.notifications?.rentDue?.email ?? true,
      sms: payload.notifications?.rentDue?.sms ?? false,
      inApp: payload.notifications?.rentDue?.inApp ?? true,
      smsProvider: "",
      emailTemplate: "",
    },
    paymentSettings: {
      enableAutopay: false,
      autopayThreshold: 0,
      acceptedMethods: [],
      paymentProviders: [],
    },
    documentAccess: {
      allowUploads: true,
      maxFileSize: 10485760,
      allowedFileTypes: ["pdf", "doc", "docx", "jpg", "png"],
      requireApproval: false,
      retentionDays: 365,
    },
    maintenancePreferences: {
      enableRequests: true,
      requireTenantApproval: false,
      estimatedResponseTime: 48,
      allowEmergencyAfterHours: true,
      priorityLevels: [],
    },
    featureToggles: {
      paymentPortal: payload.tenantPortal?.portalFeatures?.rentPayment ?? true,
      maintenanceRequests:
        payload.tenantPortal?.portalFeatures?.maintenanceRequests ?? true,
      documentAccess:
        payload.tenantPortal?.portalFeatures?.documentAccess ?? true,
      messages: payload.tenantPortal?.portalFeatures?.messages ?? true,
      announcements:
        payload.tenantPortal?.portalFeatures?.announcements ?? true,
      evictionNotice:
        payload.tenantPortal?.portalFeatures?.evictionNotice ?? false,
    },
    communicationPreferences: {
      preferredContactMethod: "email",
      languages: ["en"],
      timezone: "UTC",
      doNotDisturb: {
        enabled: false,
        startTime: "",
        endTime: "",
      },
    },
    securitySettings: {
      allowPasswordChange: true,
      autoLogoutEnabled: payload.security?.autoLogout?.enabled ?? true,
      autoLogoutInactivityMinutes:
        payload.security?.autoLogout?.durationMinutes ?? 30,
      allowAccountDeletion: false,
      allowProfileEditing: payload.security?.allowProfileEditing ?? true,
      autoLockEnabled: payload.security?.autoLockout?.enabled ?? false,
      failedLoginThreshold: payload.security?.autoLockout?.threshold ?? 5,
      requirePasswordReset: false,
      passwordExpirationDays: 90,
    },
    financeSettings: {
      currency: payload.finance?.currency?.code || "USD",
      paymentMethods: payload.finance?.paymentMethods || [],
    },
  };
}

/**
 * Legacy conversion function - kept for backwards compatibility
 * DEPRECATED: Use convertPayloadToTenantPortalSettings instead
 */
export function convertToNestedSettings(
  flatSettings: FlatSettingsData,
): TenantPortalSettings {
  return {
    notificationPreferences: {
      email: flatSettings.notificationSettings_emailNotifications ?? true,
      sms: flatSettings.notificationSettings_smsNotifications ?? false,
      inApp: true,
      smsProvider: "",
      emailTemplate: "",
    },
    paymentSettings: {
      enableAutopay: false,
      autopayThreshold: 0,
      acceptedMethods: [],
      paymentProviders: [],
    },
    documentAccess: {
      allowUploads: true,
      maxFileSize: 10485760,
      allowedFileTypes: ["pdf", "doc", "docx", "jpg", "png"],
      requireApproval: false,
      retentionDays: 365,
    },
    maintenancePreferences: {
      enableRequests: true,
      requireTenantApproval: false,
      estimatedResponseTime: 48,
      allowEmergencyAfterHours: true,
      priorityLevels: [],
    },
    featureToggles: {
      paymentPortal: flatSettings.tenantPortalFeatures_rentPayment ?? true,
      maintenanceRequests:
        flatSettings.tenantPortalFeatures_maintenanceRequests ?? true,
      documentAccess: flatSettings.tenantPortalFeatures_documentAccess ?? true,
      messages: flatSettings.tenantPortalFeatures_messages ?? true,
      evictionNotice: flatSettings.tenantPortalFeatures_evictionNotice ?? false,
    },
    communicationPreferences: {
      preferredContactMethod: "email",
      languages: ["en"],
      timezone: "UTC",
      doNotDisturb: {
        enabled: false,
        startTime: "",
        endTime: "",
      },
    },
    securitySettings: {
      allowPasswordChange: true,
      autoLogoutEnabled:
        flatSettings.tenantPortalSecurity_autoLogoutInactivityMinutes !==
        undefined,
      autoLogoutInactivityMinutes:
        flatSettings.tenantPortalSecurity_autoLogoutInactivityMinutes ?? 30,
      allowAccountDeletion: false,
      allowProfileEditing:
        flatSettings.tenantPortalSecurity_allowProfileEditing ?? true,
      autoLockEnabled:
        flatSettings.tenantPortalSecurity_autoLockEnabled ?? false,
      failedLoginThreshold:
        flatSettings.tenantPortalSecurity_failedLoginThreshold ?? 5,
      requirePasswordReset: false,
      passwordExpirationDays: 90,
    },
    financeSettings: {
      currency: flatSettings.financeSettings_currency || "USD",
      exchangeRates: {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        KES: 140,
      },
      paymentMethods: [],
    },
  };
}

/**
 * Fetch settings from API - fetch admin's own settings
 */
export async function fetchSettingsFromApi(
  token?: string,
): Promise<SettingsPayload | null> {
  try {
    const res = await apiRequest("GET", "/settings", undefined, token);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to fetch settings from API: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }
    const data = await res.json();
    return data || null;
  } catch (error) {
    console.warn(
      "Failed to fetch settings from API, falling back to local storage:",
      error,
    );
    // Local fallback: use system settings stored in local DB
    try {
      const sys = initializeSystemSettings();
      if (!sys) return null;
      const payload: SettingsPayload = {
        _id: sys.id,
        createdAt: sys.createdAt,
        updatedAt: sys.updatedAt,
        // map tenant portal feature toggles
        tenantPortal: {
          portalFeatures: {
            rentPayment:
              !!sys.tenantPortalSettings?.featureToggles?.paymentPortal,
            maintenanceRequests:
              !!sys.tenantPortalSettings?.featureToggles?.maintenanceRequests,
            documentAccess:
              !!sys.tenantPortalSettings?.featureToggles?.documentAccess,
            messages: !!sys.tenantPortalSettings?.featureToggles?.messages,
            announcements:
              !!sys.tenantPortalSettings?.featureToggles?.announcements,
            evictionNotice:
              !!sys.tenantPortalSettings?.featureToggles?.evictionNotice,
          },
        },
        finance: {
          currency: {
            code: sys.tenantPortalSettings?.financeSettings?.currency || "USD",
          },
          exchangeRates: sys.tenantPortalSettings?.financeSettings
            ?.exchangeRates || {
            USD: 1,
            EUR: 0.92,
            GBP: 0.79,
            KES: 140,
          },
        },
      };

      return payload;
    } catch (e) {
      return null;
    }
  }
}

/**
 * Fetch settings by ID from API
 */
export async function fetchSettingsByIdFromApi(
  id: string,
  token?: string,
): Promise<SettingsPayload | null> {
  try {
    const res = await apiRequest("GET", `/settings/${id}`, undefined, token);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to fetch settings by ID from API: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }
    const data = await res.json();
    return data || null;
  } catch (error) {
    console.warn(
      `Failed to fetch settings ${id} from API, falling back to local storage:`,
      error,
    );
    try {
      const sys = initializeSystemSettings();
      if (!sys) return null;
      // If local settings id matches requested id, return it, otherwise return local as fallback
      const payload: SettingsPayload = {
        _id: sys.id,
        createdAt: sys.createdAt,
        updatedAt: sys.updatedAt,
        tenantPortal: {
          portalFeatures: {
            rentPayment:
              !!sys.tenantPortalSettings?.featureToggles?.paymentPortal,
            maintenanceRequests:
              !!sys.tenantPortalSettings?.featureToggles?.maintenanceRequests,
            documentAccess:
              !!sys.tenantPortalSettings?.featureToggles?.documentAccess,
            messages: !!sys.tenantPortalSettings?.featureToggles?.messages,
            announcements:
              !!sys.tenantPortalSettings?.featureToggles?.announcements,
            evictionNotice:
              !!sys.tenantPortalSettings?.featureToggles?.evictionNotice,
          },
        },
        finance: {
          currency: {
            code: sys.tenantPortalSettings?.financeSettings?.currency || "USD",
          },
          exchangeRates: sys.tenantPortalSettings?.financeSettings
            ?.exchangeRates || {
            USD: 1,
            EUR: 0.92,
            GBP: 0.79,
            KES: 140,
          },
        },
      };
      return payload;
    } catch (e) {
      return null;
    }
  }
}
export async function fetchSettingsByTenantId(
  id: string,
  token?: string,
): Promise<SettingsPayload | null> {
  try {
    const res = await apiRequest(
      "GET",
      `/settings/tenant/${id}`,
      undefined,
      token,
    );
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to fetch settings by tenant ID from API: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }
    const data = normalizeSettingsResponse<SettingsPayload>(await res.json());
    return data || null;
  } catch (error) {
    console.warn(
      `Failed to fetch settings ${id} from API, falling back to local storage:`,
      error,
    );
    try {
      const sys = initializeSystemSettings();
      if (!sys) return null;
      const payload: SettingsPayload = {
        _id: sys.id,
        createdAt: sys.createdAt,
        updatedAt: sys.updatedAt,
        tenantPortal: {
          portalFeatures: {
            rentPayment:
              !!sys.tenantPortalSettings?.featureToggles?.paymentPortal,
            maintenanceRequests:
              !!sys.tenantPortalSettings?.featureToggles?.maintenanceRequests,
            documentAccess:
              !!sys.tenantPortalSettings?.featureToggles?.documentAccess,
            messages: !!sys.tenantPortalSettings?.featureToggles?.messages,
            announcements:
              !!sys.tenantPortalSettings?.featureToggles?.announcements,
            evictionNotice:
              !!sys.tenantPortalSettings?.featureToggles?.evictionNotice,
          },
        },
        finance: {
          currency: {
            code: sys.tenantPortalSettings?.financeSettings?.currency || "USD",
          },
          exchangeRates: sys.tenantPortalSettings?.financeSettings
            ?.exchangeRates || {
            USD: 1,
            EUR: 0.92,
            GBP: 0.79,
            KES: 140,
          },
        },
      };
      return payload;
    } catch (e) {
      return null;
    }
  }
}

/**
 * Create settings on API
 */
export async function createSettingsOnApi(
  settingsData: Partial<SettingsPayload>,
  token?: string,
): Promise<SettingsPayload | null> {
  try {
    const res = await apiRequest("POST", "/settings", settingsData, token);
    const data = normalizeSettingsResponse<SettingsPayload>(await res.json());
    return data || null;
  } catch (error) {
    console.warn(
      "Failed to create settings on API, falling back to local storage:",
      error,
    );
    try {
      // Ensure there is a system settings record
      const sys = initializeSystemSettings();
      // Map provided payload into tenantPortalSettings where possible
      const tenantSettings = convertPayloadToTenantPortalSettings(
        settingsData as SettingsPayload,
      );
      updateTenantPortalSettings(tenantSettings);
      const payload: SettingsPayload = {
        _id: sys.id,
        createdAt: sys.createdAt,
        updatedAt: sys.updatedAt,
        tenantPortal: {
          portalFeatures: {
            rentPayment: !!tenantSettings.featureToggles.paymentPortal,
            maintenanceRequests:
              !!tenantSettings.featureToggles.maintenanceRequests,
            documentAccess: !!tenantSettings.featureToggles.documentAccess,
            messages: !!tenantSettings.featureToggles.messages,
            announcements: !!tenantSettings.featureToggles.announcements,
            evictionNotice: !!tenantSettings.featureToggles.evictionNotice,
          },
        },
        finance: {
          currency: {
            code: tenantSettings.financeSettings?.currency || "USD",
          },
        },
      };
      if (tenantSettings.financeSettings?.paymentMethods) {
        payload.finance = {
          ...payload.finance,
          paymentMethods: tenantSettings.financeSettings.paymentMethods,
        };
      }
      return payload;
    } catch (e) {
      console.warn("Local fallback create failed:", e);
      return null;
    }
  }
}

/**
 * Update settings on API
 */
export async function updateSettingsOnApi(
  id: string,
  settingsData: Partial<SettingsPayload>,
  token?: string,
): Promise<SettingsPayload | null> {
  try {
    const res = await apiRequest("PUT", `/settings/${id}`, settingsData, token);
    const data = normalizeSettingsResponse<SettingsPayload>(await res.json());
    return data || null;
  } catch (error) {
    console.warn(
      `Failed to update settings ${id} on API, falling back to local storage:`,
      error,
    );
    try {
      // Try updating local system settings
      const sys = getSystemSettings();
      if (!sys) {
        // Create default then update
        const created = createDefaultSystemSettings();
        const tenantSettings = convertPayloadToTenantPortalSettings(
          settingsData as SettingsPayload,
        );
        updateTenantPortalSettings(tenantSettings);
        if (settingsData.notifications?.templates) {
          updateSystemSettings({
            notifications: {
              ...created.notifications,
              templates: settingsData.notifications.templates,
              schedules: created.notifications?.schedules ?? {},
            },
          });
        }
        return {
          _id: created.id,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          tenantPortal: { portalFeatures: {} },
          finance: {
            currency: {
              code: tenantSettings.financeSettings?.currency || "USD",
            },
            exchangeRates: tenantSettings.financeSettings?.exchangeRates,
            paymentMethods:
              tenantSettings.financeSettings?.paymentMethods || [],
          },
        };
      }

      // Merge into tenant portal settings
      const tenantSettings = convertPayloadToTenantPortalSettings(
        settingsData as SettingsPayload,
      );

      if (settingsData.notifications?.templates) {
        const existing = getSystemSettings();
        if (existing) {
          updateSystemSettings({
            notifications: {
              ...existing.notifications,
              templates: settingsData.notifications.templates,
              schedules: existing.notifications?.schedules ?? {},
            },
          });
        }
      }

      const updated = updateTenantPortalSettings(tenantSettings);
      if (!updated) return null;
      return {
        _id: updated.id,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        tenantPortal: { portalFeatures: tenantSettings.featureToggles as any },
        finance: {
          currency: { code: tenantSettings.financeSettings?.currency || "USD" },
          exchangeRates: tenantSettings.financeSettings?.exchangeRates,
          paymentMethods: tenantSettings.financeSettings?.paymentMethods || [],
        },
      };
    } catch (e) {
      console.warn("Local fallback update failed:", e);
      return null;
    }
  }
}

/**
 * Delete settings on API
 */
export async function deleteSettingsOnApi(id: string): Promise<boolean> {
  try {
    await apiRequest("DELETE", `/settings/${id}`);
    return true;
  } catch (error) {
    console.warn(`Failed to delete settings ${id} on API:`, error);
    return false;
  }
}

// ============================================================================
// Independent Field Updates - Real-time Persistence
// ============================================================================

/**
 * Simple debounce helper
          exchangeRates:
            sys.tenantPortalSettings?.financeSettings?.exchangeRates || {
              USD: 1,
              EUR: 0.92,
              GBP: 0.79,
              KES: 140,
            },
 * Delays function execution, cancels previous pending calls on new invocation
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  delayMs: number,
): (...args: Parameters<T>) => Promise<any> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    return new Promise((resolve, reject) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delayMs);
    });
  };
}

/**
 * Update a single setting field on the API
 * Sends only the flat key that changed
 */
export async function updateSettingFieldAsync(
  settingsId: string,
  flatKey: string,
  value: any,
): Promise<boolean> {
  if (!settingsId) {
    console.warn("Cannot update field without settingsId");
    return false;
  }

  try {
    const flatUpdate = { [flatKey]: value };
    const result = await updateSettingsOnApi(settingsId, flatUpdate);
    return !!result;
  } catch (error) {
    console.error(`Failed to update field ${flatKey}:`, error);
    return false;
  }
}

/**
 * Create a debounced field update handler
 * Returns a function that can be called repeatedly; only latest value is persisted
 */
export function createFieldUpdateHandler(
  settingsId: string | null,
  flatKey: string,
  onSettingsIdCreated?: (id: string) => void,
  debounceMs: number = 500,
): (value: any) => Promise<void> {
  const debouncedUpdate = debounce(async (value: any) => {
    if (!settingsId) {
      // Auto-create settings on first change
      const created = await createSettingsOnApi({ [flatKey]: value });
      if (created?._id && onSettingsIdCreated) {
        onSettingsIdCreated(created._id);
      }
      return;
    }

    await updateSettingFieldAsync(settingsId, flatKey, value);
  }, debounceMs);

  return async (value: any) => {
    try {
      await debouncedUpdate(value);
    } catch (error) {
      console.error(`Error updating field ${flatKey}:`, error);
    }
  };
}

/**
 * Field status type for UI feedback
 */
export type FieldStatus = "idle" | "saving" | "saved" | "error";

/**
 * Helper to manage per-field saving status
 */
export class FieldStatusManager {
  private statusMap: Record<string, FieldStatus> = {};

  setStatus(flatKey: string, status: FieldStatus): void {
    this.statusMap[flatKey] = status;
  }

  getStatus(flatKey: string): FieldStatus {
    return this.statusMap[flatKey] ?? "idle";
  }

  markSaving(flatKey: string): void {
    this.setStatus(flatKey, "saving");
  }

  markSaved(flatKey: string): void {
    this.setStatus(flatKey, "saved");
  }

  markError(flatKey: string): void {
    this.setStatus(flatKey, "error");
  }

  markIdle(flatKey: string): void {
    this.setStatus(flatKey, "idle");
  }

  getAll(): Record<string, FieldStatus> {
    return { ...this.statusMap };
  }
}

// ============================================================================
// Tenant Portal Feature Helpers
// ============================================================================

/**
 * Extract feature toggles from settings payload
 * Returns the featureToggles object with safe defaults
 */
export function getFeatureToggles(
  payload: SettingsPayload | null,
): FeatureToggles {
  if (!payload) {
    return {
      paymentPortal: true,
      maintenanceRequests: true,
      documentAccess: true,
      messages: true,
      evictionNotice: false,
    };
  }

  const portalSettings = convertPayloadToTenantPortalSettings(payload);
  return portalSettings.featureToggles || {};
}

/**
 * Check if a specific feature is enabled
 * Returns true by default if feature is not explicitly disabled
 */
export function isFeatureEnabled(
  payload: SettingsPayload | null,
  featureName: keyof FeatureToggles,
): boolean {
  const toggles = getFeatureToggles(payload);
  return toggles[featureName] ?? true;
}
