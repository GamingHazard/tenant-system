"use client";

import { useMemo, useState, useEffect } from "react";
import BioSection from "@/components/forms/tenant-profile-sections/BioSection";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Lock,
  Mail,
  User,
  LogOut,
  Save,
  Check,
  MapPin,
  Phone,
  CalendarDays,
  ClipboardCheck,
  Loader,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAppData } from "@/lib/data-context";
import {
  TenantRecord,
  updateTenantApi,
  updateTenantAvatarApi,
} from "@/lib/services/tenants";
import { changePassword } from "@/lib/services/authApi";
import { getTenantTypeConfig } from "@/lib/services/settings";
import { getAuthToken } from "@/lib/token-manager";
import { useTenantContext } from "@/lib/tenant-context";
import { notifyTenantProfileUpdateToAdmin } from "@/lib/services/notifications";
import { useSettings } from "@/lib/settings-context";

const tabItems = [
  { id: "profile", label: "Profile" },
  { id: "finances", label: "Finances" },
  { id: "notifications", label: "Notifications" },
  // { id: "emergency", label: "Emergency Contact" },
  // { id: "moveout", label: "Move-Out Notice" },
  { id: "security", label: "Security" },
  // { id: "documents", label: "Document Delivery" },
] as const;

type TabId = (typeof tabItems)[number]["id"];

type NotificationType =
  | "paymentReminder"
  | "paymentReceived"
  | "maintenanceScheduled"
  | "maintenanceCompleted"
  | "messages"
  | "leaseExpiryAlert"
  | "financeReports"
  | "profileChanges"
  | "announcements"
  | "propertyUpdates";

type NotificationPreferences = Record<
  NotificationType,
  { email: boolean; sms: boolean }
>;

const defaultNotificationPreferences: NotificationPreferences = {
  paymentReminder: { email: true, sms: false },
  paymentReceived: { email: true, sms: false },
  maintenanceScheduled: { email: true, sms: false },
  maintenanceCompleted: { email: true, sms: false },
  messages: { email: true, sms: false },
  leaseExpiryAlert: { email: true, sms: false },
  financeReports: { email: true, sms: false },
  profileChanges: { email: true, sms: false },
  announcements: { email: false, sms: false },
  propertyUpdates: { email: false, sms: false },
};

const moveOutReasons = [
  { value: "end_of_lease", label: "End of Lease" },
  { value: "relocation", label: "Job Relocation" },
  { value: "personal", label: "Personal Reasons" },
  { value: "other", label: "Other" },
];

const autoPayScheduleOptions = [
  { value: "monthly_day", label: "Monthly on a specific day" },
  { value: "rent_due_date", label: "On rent due date" },
] as const;

function getAdminPaymentMethodDisplayName(type: string) {
  switch (type) {
    case "Visa_Mastercard":
      return "Credit / Debit Card";
    case "Bank_Transfer":
      return "Bank Transfer";
    case "MTN_MoMo":
      return "MTN Mobile Money";
    case "Airtel_Money":
      return "Airtel Money";
    case "Orange_Money":
      return "Orange Money";
    case "Paystack":
      return "Paystack";
    default:
      return type.replace(/[_-]/g, " ");
  }
}

function getAdminPaymentMethodDescription(method: any) {
  if (method.transactionNumber) {
    return `Use ${method.transactionNumber}`;
  }
  if (method.bankDetails?.bankName) {
    return `Account ${method.bankDetails.bankName}`;
  }
  return "";
}

export default function TenantSettingsPage() {
  const { currentTenant: tenant } = useTenantContext();
  const { settings: apiSettings } = useSettings();

  const [viewPassword, setViewPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saveStatus, setSaveStatus] = useState<Record<TabId, boolean>>({
    profile: false,
    finances: false,
    notifications: false,
    // emergency: false,
    // moveout: false,
    security: false,
    // documents: false,
  });
  const [saveError, setSaveError] = useState<Record<TabId, string | null>>({
    profile: null,
    finances: null,
    notifications: null,
    // emergency: null,
    // moveout: null,
    security: null,
    // documents: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Load tenant type configuration for defaults
  const tenantTypeConfig = useMemo(
    () => (tenant?.tenantType ? getTenantTypeConfig(tenant.tenantType) : null),
    [tenant?.tenantType],
  );

  const [profile, setProfile] = useState({
    firstName: tenant?.name?.split(" ")[0] || "",
    lastName: tenant?.name?.split(" ").slice(1).join(" ") || "",
    name: tenant?.name || "",
    email: tenant?.email || "",
    phone: tenant?.phone || "",
    coSigner: tenant?.coSigner || "",
    emergencyContactPhone:
      tenant?.emergencyContactPhone || tenant?.emergencyContact || "",
    pets: tenant?.pets || "",
    vehicles: tenant?.vehicles || "",
    businessInfo: tenant?.businessInfo || "",
    businessContacts: tenant?.businessContacts || "",
    financialInfo: tenant?.financialInfo || "",
    image: tenant?.avatar?.url
      ? {
          url: tenant.avatar.url,
          public_id: tenant.avatar.public_id || "",
        }
      : undefined,
    preferredContactMethod:
      tenant?.preferredContactMethod ||
      tenantTypeConfig?.defaultSettings?.preferredContactMethod ||
      "email",
  });

  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(
      tenant?.notificationPreferences ?? defaultNotificationPreferences,
    );

  const [emergencyContact, setEmergencyContact] = useState({
    name: tenant?.emergencyContactName || "",
    phone: tenant?.emergencyContactPhone || "",
    email: tenant?.emergencyContactEmail || "",
  });

  const [paymentMethod, setPaymentMethod] = useState({
    provider: tenant?.paymentMethod?.provider || "",
    label: tenant?.paymentMethod?.label || "",
    externalId: tenant?.paymentMethod?.externalId || "",
  });

  const availablePaymentMethods = useMemo(
    () =>
      (apiSettings?.finance?.paymentMethods || []).filter(
        (method: any) => method.enabled,
      ),
    [apiSettings],
  );

  const [autoPay, setAutoPay] = useState({
    enabled: tenant?.autoPay?.enabled ?? false,
    scheduleType: tenant?.autoPay?.scheduleType || "monthly_day",
    dayOfMonth: tenant?.autoPay?.dayOfMonth || 1,
    nextRunDate: tenant?.autoPay?.nextRunDate || "",
    status: tenant?.autoPay?.status || "active",
    retryAttempts: tenant?.autoPay?.retryAttempts ?? 0,
    lastError: tenant?.autoPay?.lastError || "",
  });

  const [moveOutNotice, setMoveOutNotice] = useState({
    noticeDate: tenant?.moveOutNotice?.noticeDate || "",
    reason: tenant?.moveOutNotice?.reason || "end_of_lease",
    forwardingAddress: tenant?.moveOutNotice?.forwardingAddress || "",
    additionalNotes: tenant?.moveOutNotice?.additionalNotes || "",
    status: tenant?.moveOutNotice?.status || "draft",
  });

  const [passwordState, setPasswordState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    error: "",
  });

  useEffect(() => {
    if (!tenant) return;
    setProfile({
      firstName: tenant.name?.split(" ")[0] || "",
      lastName: tenant.name?.split(" ").slice(1).join(" ") || "",
      name: tenant.name || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      coSigner: tenant.coSigner || "",
      emergencyContactPhone:
        tenant.emergencyContactPhone || tenant.emergencyContact || "",
      pets: tenant.pets || "",
      vehicles: tenant.vehicles || "",
      businessInfo: tenant.businessInfo || "",
      businessContacts: tenant.businessContacts || "",
      financialInfo: tenant.financialInfo || "",
      image: tenant.avatar?.url
        ? {
            url: tenant.avatar.url,
            public_id: tenant.avatar.public_id || "",
          }
        : undefined,
      preferredContactMethod:
        tenant.preferredContactMethod ||
        tenantTypeConfig?.defaultSettings?.preferredContactMethod ||
        "email",
    });

    const provider = tenant.paymentMethod?.provider || "";
    const adminLabel = getAdminPaymentMethodDisplayName(provider);
    const isAdminMethod = apiSettings?.finance?.paymentMethods?.some(
      (method: any) => method.type === provider,
    );

    setPaymentMethod({
      provider,
      label: isAdminMethod ? adminLabel : tenant.paymentMethod?.label || "",
      externalId: tenant.paymentMethod?.externalId || "",
    });

    setAutoPay({
      enabled: tenant.autoPay?.enabled ?? false,
      scheduleType: tenant.autoPay?.scheduleType || "monthly_day",
      dayOfMonth: tenant.autoPay?.dayOfMonth || 1,
      nextRunDate: tenant.autoPay?.nextRunDate || "",
      status: tenant.autoPay?.status || "active",
      retryAttempts: tenant.autoPay?.retryAttempts ?? 0,
      lastError: tenant.autoPay?.lastError || "",
    });
  }, [tenant, tenantTypeConfig]);

  const handleSave = async (section: TabId, patch: Partial<TenantRecord>) => {
    if (!tenant) return;
    const fullPatch = {
      ...patch,
      preferredContactMethod: profile.preferredContactMethod,
    };

    setIsLoading(true);
    try {
      setSaveError((prev) => ({ ...prev, [section]: null }));
      await updateTenantApi(tenant.id, fullPatch);
      const changedFields = Object.entries(fullPatch)
        .filter(([key, value]) => (tenant as any)[key] !== value)
        .map(([key]) => key);

      if (changedFields.length > 0) {
        notifyTenantProfileUpdateToAdmin(tenant.name, changedFields);
      }

      setSaveStatus((prev) => ({ ...prev, [section]: true }));
      window.setTimeout(
        () => setSaveStatus((prev) => ({ ...prev, [section]: false })),
        2000,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save settings";
      setSaveError((prev) => ({ ...prev, [section]: errorMessage }));
      console.error("Failed to save tenant settings", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (image: {
    url: string;
    public_id: string;
  }) => {
    if (!tenant) return;

    try {
      setSaveError((prev) => ({ ...prev, profile: null }));
      const updatedTenant = await updateTenantAvatarApi(tenant.id, {
        avatar: image,
      });

      if (updatedTenant) {
        setProfile((prev) => ({
          ...prev,
          image: {
            url: updatedTenant.avatar?.url || image.url,
            public_id: updatedTenant.avatar?.public_id || image.public_id,
          },
        }));
      }

      setSaveStatus((prev) => ({ ...prev, profile: true }));
      window.setTimeout(
        () => setSaveStatus((prev) => ({ ...prev, profile: false })),
        2000,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save profile image";
      setSaveError((prev) => ({ ...prev, profile: errorMessage }));
      console.error("Failed to upload tenant avatar", error);
    }
  };

  const handlePasswordSave = async () => {
    setIsLoading(true);
    // Clear previous errors
    setPasswordState((prev) => ({ ...prev, error: "" }));

    // Validate form fields
    if (!passwordState.currentPassword) {
      setPasswordState((prev) => ({
        ...prev,
        error: "Please enter your current password.",
      }));
      return;
    }

    if (!passwordState.newPassword || passwordState.newPassword.length < 6) {
      setPasswordState((prev) => ({
        ...prev,
        error: "New password must be at least 6 characters.",
      }));
      return;
    }

    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setPasswordState((prev) => ({
        ...prev,
        error: "Passwords do not match.",
      }));
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        setPasswordState((prev) => ({
          ...prev,
          error: "Authentication required. Please log in again.",
        }));
        return;
      }

      // Call the backend password change endpoint
      await changePassword(
        token,
        passwordState.currentPassword,
        passwordState.newPassword,
      );

      // Clear the form on success
      setPasswordState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        error: "",
      });

      // Show success status
      setSaveStatus((prev) => ({ ...prev, security: true }));
      window.setTimeout(
        () => setSaveStatus((prev) => ({ ...prev, security: false })),
        2000,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to change password";
      console.error("Failed to change tenant password", error);
      setPasswordState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Tenant Settings
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
          Configure your profile, notification preferences, move-out notice,
          emergency contact details, password, and document delivery options.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2 rounded-lg border border-border bg-background p-3">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "hover:bg-secondary text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {activeTab === "profile" && (
            <BioSection
              value={profile}
              onChange={(patch) =>
                setProfile((prev) => ({ ...prev, ...patch }))
              }
              onImageUpload={handleAvatarUpload}
              onSave={() => {
                const fullName = [profile.firstName, profile.lastName]
                  .filter(Boolean)
                  .join(" ");

                handleSave("profile", {
                  name: fullName || profile.name,
                  email: profile.email,
                  phone: profile.phone,
                  coSigner: profile.coSigner,
                  emergencyContactPhone: profile.emergencyContactPhone,
                  pets: profile.pets,
                  vehicles: profile.vehicles,
                  businessInfo: profile.businessInfo,
                  businessContacts: profile.businessContacts,
                  financialInfo: profile.financialInfo,
                  preferredContactMethod: profile.preferredContactMethod,
                  avatar: profile?.image,
                });
              }}
              isSaving={isLoading && saveStatus.profile === false}
            />
          )}
          {/* Finances Tab Content */}
          {activeTab === "finances" && (
            <Card className="border border-border p-4 md:p-6">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    Finances & Auto-Pay
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Choose a payment method and configure automatic rent
                    payments.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    (NOTE: Payment features are not functional, contact the
                    administrator for assistance with rent payments)
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Preferred Payment Method
                    </label>
                    {availablePaymentMethods.length > 0 ? (
                      <div className="space-y-3">
                        {availablePaymentMethods.map((method: any) => {
                          const methodId = method._id || method.type;
                          const displayName = getAdminPaymentMethodDisplayName(
                            method.type,
                          );
                          const description =
                            getAdminPaymentMethodDescription(method);
                          const selected =
                            paymentMethod.provider === method.type;

                          return (
                            <button
                              key={methodId}
                              type="button"
                              onClick={() =>
                                setPaymentMethod({
                                  provider: method.type,
                                  label: displayName,
                                  externalId: paymentMethod.externalId,
                                })
                              }
                              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                selected
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-background hover:border-primary/50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {displayName}
                                  </p>
                                  {description ? (
                                    <p className="text-sm text-muted-foreground">
                                      {description}
                                    </p>
                                  ) : null}
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    selected
                                      ? "border-primary bg-primary"
                                      : "border-border"
                                  }`}
                                >
                                  {selected ? (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                        No active payment methods are configured. Contact your
                        property manager to enable a payment option.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Payment Method Reference
                    </label>
                    <input
                      value={paymentMethod.externalId}
                      onChange={(e) =>
                        setPaymentMethod((prev) => ({
                          ...prev,
                          externalId: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                      placeholder="Card last 4 digits, account label, or reference"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="lg:col-span-2">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Enable Auto-Pay
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          disabled={true} // Disable auto-pay toggle for now since feature is not fully implemented
                          type="checkbox"
                          checked={autoPay.enabled}
                          onChange={(e) =>
                            setAutoPay((prev) => ({
                              ...prev,
                              enabled: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-border"
                        />
                        <span className="text-sm text-foreground">
                          Activate auto-pay
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Auto-Pay Schedule
                    </label>
                    <select
                      value={autoPay.scheduleType}
                      onChange={(e) =>
                        setAutoPay((prev) => ({
                          ...prev,
                          scheduleType: e.target
                            .value as typeof autoPay.scheduleType,
                        }))
                      }
                      disabled={!autoPay.enabled}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                    >
                      {autoPayScheduleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {autoPay.scheduleType === "monthly_day" && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Day of Month
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={autoPay.dayOfMonth}
                        onChange={(e) =>
                          setAutoPay((prev) => ({
                            ...prev,
                            dayOfMonth: Number(e.target.value) || 1,
                          }))
                        }
                        disabled={!autoPay.enabled}
                        className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Next Auto-Pay Date
                    </label>
                    <input
                      type="date"
                      value={autoPay.nextRunDate}
                      onChange={(e) =>
                        setAutoPay((prev) => ({
                          ...prev,
                          nextRunDate: e.target.value,
                        }))
                      }
                      disabled={!autoPay.enabled}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Auto-pay status is stored for reference and can help if a
                    scheduled payment fails.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-medium text-foreground">
                        {autoPay.enabled ? autoPay.status : "Disabled"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Retry Attempts
                      </p>
                      <p className="font-medium text-foreground">
                        {autoPay.retryAttempts}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Last Error
                      </p>
                      <p className="font-medium text-foreground">
                        {autoPay.lastError || "None"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <Button
                  disabled={availablePaymentMethods.length === 0} // Disable save if no payment methods are available
                  onClick={() =>
                    handleSave("finances", {
                      paymentMethod,
                      autoPay,
                    })
                  }
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  {saveStatus.finances ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Finances Settings
                    </>
                  )}
                </Button>
                {saveError.finances ? (
                  <p className="text-sm text-destructive mt-3">
                    {saveError.finances}
                  </p>
                ) : null}
              </div>
            </Card>
          )}
          {/* Notification settings and other tabs would go here... */}
          {activeTab === "notifications" && (
            <Card className="border border-border p-4 md:p-6">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    Notification Preferences
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Control which notifications you receive and how you receive
                    them.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: "paymentReminder" as NotificationType,
                    label: "Rent Overdue Alerts",
                    description: "Notify me when rent payment is overdue",
                  },
                  {
                    key: "leaseExpiryAlert" as NotificationType,
                    label: "Lease End Reminders",
                    description: "Notify me before your lease expires",
                  },
                  {
                    key: "maintenanceScheduled" as NotificationType,
                    label: "Maintenance Scheduled",
                    description:
                      "Notify me when a maintenance visit is scheduled",
                  },
                  {
                    key: "profileChanges" as NotificationType,
                    label: "Profile Updates",
                    description: "Notify me when admin updates my profile",
                  },
                  {
                    key: "messages" as NotificationType,
                    label: "Messages & Announcements",
                    description:
                      "Notify me of new messages when I am logged out",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-border p-4 bg-background"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <input
                            type="checkbox"
                            checked={notificationPreferences[item.key].email}
                            onChange={(e) =>
                              setNotificationPreferences((prev) => ({
                                ...prev,
                                [item.key]: {
                                  ...prev[item.key],
                                  email: e.target.checked,
                                },
                              }))
                            }
                            className="w-4 h-4 rounded border-border"
                          />
                          <span className="text-sm text-foreground">Email</span>
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <input
                            disabled={true} // Example: disable SMS for lease expiry alerts
                            type="checkbox"
                            checked={notificationPreferences[item.key].sms}
                            onChange={(e) =>
                              setNotificationPreferences((prev) => ({
                                ...prev,
                                [item.key]: {
                                  ...prev[item.key],
                                  sms: e.target.checked,
                                },
                              }))
                            }
                            className="w-4 h-4 rounded border-border"
                          />
                          <span className="text-sm text-foreground">SMS</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <Button
                  onClick={() =>
                    handleSave("notifications", { notificationPreferences })
                  }
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  {saveStatus.notifications ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Notification Settings
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* {activeTab === "emergency" && (
            <Card className="border border-border p-4 md:p-6">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    Emergency Contact
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Add someone we can reach if there is an urgent issue at your
                    unit.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Contact Name
                  </label>
                  <input
                    value={emergencyContact.name}
                    onChange={(e) =>
                      setEmergencyContact({
                        ...emergencyContact,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Phone
                  </label>
                  <input
                    value={emergencyContact.phone}
                    onChange={(e) =>
                      setEmergencyContact({
                        ...emergencyContact,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                    placeholder="(123) 456-7890"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={emergencyContact.email}
                    onChange={(e) =>
                      setEmergencyContact({
                        ...emergencyContact,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <Button
                  onClick={() =>
                    handleSave("emergency", {
                      emergencyContactName: emergencyContact.name,
                      emergencyContactPhone: emergencyContact.phone,
                      emergencyContactEmail: emergencyContact.email,
                    })
                  }
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  {saveStatus.emergency ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Emergency Contact
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )} */}

          {/* {activeTab === "moveout" && (
            <Card className="border border-border p-4 md:p-6">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    Move-Out Notice
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Submit your planned move-out notice so your landlord can
                    prepare for your departure.
                  </p>
                </div>
              </div>

              {moveOutNotice.status === "submitted" ? (
                <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="font-semibold text-foreground">
                    Notice Submitted
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your move-out notice has been submitted and cannot be
                    edited.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Notice Date
                      </p>
                      <p className="font-medium text-foreground">
                        {moveOutNotice.noticeDate || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reason</p>
                      <p className="font-medium text-foreground">
                        {moveOutReasons.find(
                          (item) => item.value === moveOutNotice.reason,
                        )?.label || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">
                        Forwarding Address
                      </p>
                      <p className="font-medium text-foreground">
                        {moveOutNotice.forwardingAddress || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">
                        Additional Notes
                      </p>
                      <p className="font-medium text-foreground">
                        {moveOutNotice.additionalNotes || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Notice Date
                      </label>
                      <input
                        type="date"
                        value={moveOutNotice.noticeDate}
                        onChange={(e) =>
                          setMoveOutNotice({
                            ...moveOutNotice,
                            noticeDate: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Reason
                      </label>
                      <select
                        value={moveOutNotice.reason}
                        onChange={(e) =>
                          setMoveOutNotice({
                            ...moveOutNotice,
                            reason: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                      >
                        {moveOutReasons.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Forwarding Address
                    </label>
                    <textarea
                      value={moveOutNotice.forwardingAddress}
                      onChange={(e) =>
                        setMoveOutNotice({
                          ...moveOutNotice,
                          forwardingAddress: e.target.value,
                        })
                      }
                      rows={4}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                      placeholder="Address where we can send deposit details and final paperwork"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Additional Notes
                    </label>
                    <textarea
                      value={moveOutNotice.additionalNotes}
                      onChange={(e) =>
                        setMoveOutNotice({
                          ...moveOutNotice,
                          additionalNotes: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                      placeholder="Optional details for your landlord"
                    />
                  </div>

                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-foreground">
                    Sending this notice will notify your landlord of your
                    planned move-out date. After submission, it will become
                    read-only.
                  </div>

                  <div className="pt-6 border-t border-border mt-6">
                    <Button
                      onClick={() => {
                        setMoveOutNotice((prev) => ({
                          ...prev,
                          status: "submitted",
                        }));
                        handleSave("moveout", {
                          moveOutNotice: {
                            ...moveOutNotice,
                            status: "submitted",
                          },
                        });
                      }}
                      className="bg-primary hover:bg-primary/90 text-white gap-2"
                    >
                      {saveStatus.moveout ? (
                        <>
                          <Check className="w-4 h-4" />
                          Submitted
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="w-4 h-4" />
                          Submit Move-Out Notice
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )} */}

          {activeTab === "security" && (
            <Card className="border border-border p-4 md:p-6">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    Security
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Change your password and keep your account secure.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Current Password
                  </label>
                  <input
                    type={viewPassword ? "text" : "password"}
                    value={passwordState.currentPassword}
                    onChange={(e) =>
                      setPasswordState({
                        ...passwordState,
                        currentPassword: e.target.value,
                        error: "",
                      })
                    }
                    placeholder="********"
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                  {viewPassword ? (
                    <Eye
                      onClick={() => setViewPassword(false)}
                      className="w-4 h-4 z-10 absolute right-3 top-12 cursor-pointer"
                    />
                  ) : (
                    <EyeOff
                      onClick={() => setViewPassword(true)}
                      className="w-4 h-4 z-10 absolute right-3 top-12 cursor-pointer"
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    New Password
                  </label>
                  <input
                    type={viewPassword ? "text" : "password"}
                    placeholder="********"
                    value={passwordState.newPassword}
                    onChange={(e) =>
                      setPasswordState({
                        ...passwordState,
                        newPassword: e.target.value,
                        error: "",
                      })
                    }
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Confirm Password
                  </label>
                  <input
                    type={viewPassword ? "text" : "password"}
                    placeholder="********"
                    value={passwordState.confirmPassword}
                    onChange={(e) =>
                      setPasswordState({
                        ...passwordState,
                        confirmPassword: e.target.value,
                        error: "",
                      })
                    }
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                </div>
              </div>

              {passwordState.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {passwordState.error}
                </div>
              )}

              <div className="pt-6 border-t border-border mt-6">
                <Button
                  disabled={isLoading || saveStatus.security} // Disable button while loading or if already saved
                  onClick={handlePasswordSave}
                  className={`w-full bg-primary hover:bg-primary/90 text-white font-medium h-10 ${saveStatus.security ? "cursor-default bg-green-500 hover:bg-green-500/90" : ""}`}
                >
                  {isLoading ? (
                    <>
                      Updating...
                      <Loader className="w-4 h-4 animate-spin" />
                    </>
                  ) : saveStatus.security ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Password Updated
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* {activeTab === "documents" && (
            <Card className="border border-border p-4 md:p-6">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    Document Delivery
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Choose how you receive lease agreements, invoices, and
                    notifications.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {documentDeliveryOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-secondary cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="documentDelivery"
                      value={option.value}
                      checked={documentDelivery === option.value}
                      onChange={() =>
                        setDocumentDelivery(
                          option.value as TenantRecord["documentDelivery"],
                        )
                      }
                      className="h-4 w-4 border-border"
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        {option.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {option.value === "email"
                          ? "Receive documents only by email."
                          : option.value === "in-app"
                            ? "Receive documents only inside the tenant portal."
                            : "Receive documents both by email and in the portal."}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <Button
                  onClick={() => handleSave("documents", { documentDelivery })}
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  {saveStatus.documents ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Delivery Preference
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )} */}
        </div>
      </div>
    </div>
  );
}
