"use client";

import { useState, useEffect, useMemo } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTenant,
  deleteTenantApi,
  updateTenantApi,
  setTenantActiveStatusApi,
} from "@/lib/services/tenants";
import { notifyTenantProfileUpdateToAdmin } from "@/lib/services/notifications";
import { useAppData } from "@/lib/data-context";
import { createTransaction } from "@/app/lib/transactions-client";
import TenantForm from "@/components/forms/tenant-form";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import RecordPaymentModal from "@/components/modals/record-payment-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquareLock,
  MoreHorizontal,
  Printer,
  Share2,
} from "lucide-react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  MessageSquare,
  AlertCircle,
  Calendar,
  Edit,
  Send,
  Home,
  User,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";

interface TenantDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = use(params);
  const { properties, tenants, payments } = useAppData();
  const activeCurrency = useActiveCurrency();
  const [tenant, setTenant] = useState<any | null>(null);
  const [property, setProperty] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null,
  );
  const [copiedPassword, setCopiedPassword] = useState(false);
  const router = useRouter();

  // Edit form state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [isTogglingPortalStatus, setIsTogglingPortalStatus] = useState(false);

  const getLatestRentPaymentDate = (tenantPayments: any[]) => {
    const completedRentPayments = tenantPayments
      .filter((payment) =>
        [
          "complete",
          "completed",
          "paid",
          "balance",
          "pending",
          "failed",
          "refunded",
          "recorded",
          "confirmed",
          undefined,
          null,
        ].includes(payment.status),
      )
      .filter(
        (payment) =>
          payment.paymentType === "rent" ||
          payment.paymentType === "residential" ||
          payment.paymentType === undefined ||
          payment.paymentType === null,
      );

    if (completedRentPayments.length === 0) return "";

    const sorted = [...completedRentPayments].sort((a, b) => {
      const aTime = new Date(
        a.paidOn || a.paymentDate || a.date || undefined,
      ).getTime();
      const bTime = new Date(
        b.paidOn || b.paymentDate || b.date || undefined,
      ).getTime();
      return bTime - aTime;
    });

    return sorted[0]?.date || "";
  };

  useEffect(() => {
    const t = tenants.find((item) => item.id === id || item._id === id);
    if (t) {
      setTenant(t);
      if (t.propertyId) {
        const p = properties.find((item) => item.id === t.propertyId);
        setProperty(p);
      }
      // show existing tenant password if present
      setGeneratedPassword((t as any)?.password || null);
    }
  }, [id]);

  const tenantPaymentIds = useMemo(() => {
    if (!tenant || !Array.isArray(tenant.paymentHistory)) {
      return [];
    }
    return tenant.paymentHistory
      .filter((id: any) => id !== undefined && id !== null)
      .map((id: any) => String(id));
  }, [tenant?.paymentHistory]);

  const tenantPayments = useMemo(() => {
    if (tenantPaymentIds.length > 0) {
      return payments.filter((payment: any) =>
        tenantPaymentIds.includes(
          String(payment.id || payment._id || payment.transId),
        ),
      );
    }

    return payments.filter((payment: any) =>
      tenant
        ? payment.tenantId === tenant.id || payment.tenantId === tenant._id
        : false,
    );
  }, [payments, tenant, tenantPaymentIds]);

  const totalPaid = useMemo(
    () =>
      tenantPayments.reduce(
        (sum, payment: any) => sum + Number(payment.amount || 0),
        0,
      ),
    [tenantPayments],
  );

  const latestRentPaymentDate = useMemo(
    () => getLatestRentPaymentDate(tenantPayments),
    [tenantPayments],
  );

  const leaseRenewalHint = latestRentPaymentDate
    ? "Set from most recent rent payment."
    : "No rent payment made yet.";

  const generatePassword = async (length = 8) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let pw = "";
    for (let i = 0; i < length; i++)
      pw += chars.charAt(
        Math.floor(Math.random() * Math.random() * chars.length),
      );
    setGeneratedPassword(pw);

    // persist to tenant record if loaded
    if (tenant) {
      const updated = await updateTenantApi(tenant.id, { password: pw });
      if (updated) setTenant(updated);
    }

    return pw;
  };

  const calculateLeaseEnd = (leaseStart: string, leaseType: string) => {
    const startDate = new Date(leaseStart);
    let months = 1;

    switch (leaseType) {
      case "monthly":
      case "month-to-month":
        months = 1;
        break;
      case "3_months":
      case "3mnths":
      case "3 months":
        months = 3;
        break;
      case "half_year":
      case "6mnths":
      case "6 months":
        months = 6;
        break;
      case "full_year":
      case "annual":
      case "yearly":
      case "12 months":
        months = 12;
        break;
      default:
        months = 1;
    }

    const leaseEnd = new Date(startDate);
    leaseEnd.setMonth(leaseEnd.getMonth() + months);
    return leaseEnd;
  };

  const calculateTotalPaid = (leaseStart: string, rentAmount: number) => {
    const startDate = new Date(leaseStart);
    const today = new Date();

    // Calculate the number of months between lease start and today
    let months = 0;
    let current = new Date(startDate);

    while (current < today) {
      months++;
      current.setMonth(current.getMonth() + 1);
    }

    // Total paid is months × monthly rent
    return months * rentAmount;
  };

  const getStatusColor = (status: string) => {
    if (status === "moving out")
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    if (status === "due")
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
    return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
  };

  const getStatusLabel = (status: string) => {
    if (status === "moving out") return "Moving Out";
    if (status === "due") return "Payment Due";
    return "Rent Paid";
  };

  const getPortalStatusColor = (isActive: boolean) => {
    return isActive
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  };

  const getPortalStatusLabel = (isActive: boolean) => {
    return isActive ? "Active" : "Inactive";
  };

  const handleTogglePortalStatus = async () => {
    if (!tenant) return;
    try {
      setIsTogglingPortalStatus(true);
      const currentStatus = tenant.isActive?.status ?? true;
      const updated = await setTenantActiveStatusApi(
        tenant.id || tenant._id,
        !currentStatus,
      );
      if (updated) {
        setTenant(updated);
      }
    } catch (error) {
      console.error("Failed to toggle portal status:", error);
    } finally {
      setIsTogglingPortalStatus(false);
    }
  };

  if (!tenant) {
    return (
      <div className="space-y-6">
        <Button variant="outline" asChild>
          <Link href="/dashboard/tenants" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tenants
          </Link>
        </Button>
        <Card className="border border-border p-12 text-center">
          <p className="text-muted-foreground">Tenant not found</p>
        </Card>
      </div>
    );
  }

  const leaseEnd = tenant.leaseEndDate
    ? new Date(tenant.leaseEndDate)
    : calculateLeaseEnd(tenant.leaseStartDate || "", tenant.leaseType || "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" asChild>
          <Link href="/dashboard/tenants" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Tenant
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!tenant) return;
              const ok = confirm(
                "Are you sure you want to delete this tenant and all related data?",
              );
              if (!ok) return;
              await deleteTenantApi(tenant.id);
              router.push("/dashboard/tenants");
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Tenant Info Card */}
      <Card className="border border-border p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Avatar & Tenant Details */}
          <div className="flex items-start gap-4">
            <Image
              src={
                tenant.avatar?.url ||
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQf1fiSQO7JfDw0uv1Ae_Ye-Bo9nhGNg27dwg&s"
              }
              alt={tenant.name || "Tenant"}
              width={100}
              height={100}
              className="rounded-lg object-cover"
            />
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">
                {tenant.name}
              </h1>
              {tenant.gender && (
                <p className="text-sm text-muted-foreground mb-3 capitalize">
                  Gender: {tenant.gender}
                </p>
              )}
              {tenant.bio && (
                <p className="text-sm text-muted-foreground mb-3 max-w-md">
                  {tenant.bio}
                </p>
              )}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <a
                    href={`mailto:${tenant.email}`}
                    className="hover:text-foreground text-sm"
                  >
                    {tenant.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <a
                    href={`tel:${tenant.phone}`}
                    className="hover:text-foreground text-sm"
                  >
                    {tenant.phone}
                  </a>
                </div>
                {generatedPassword && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-mono">
                      {generatedPassword}
                    </span>
                    <button
                      className="ml-2 text-xs text-primary hover:underline"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 2000);
                      }}
                    >
                      {copiedPassword ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {!generatedPassword && (
                      <button
                        className="ml-4 text-xs text-primary hover:underline"
                        onClick={async () => {
                          const newPw = await generatePassword(8);
                          if (tenant) {
                            const updated = await updateTenantApi(tenant.id, {
                              password: newPw,
                            });
                            if (updated) setTenant(updated);
                          }
                        }}
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status & Property */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Lease Status</p>
              <span
                className={`px-4 py-2 rounded-lg text-sm font-semibold inline-block ${getStatusColor(tenant.status ?? "")}`}
              >
                {getStatusLabel(tenant.status ?? "")}
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Portal Status
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={`px-4 py-2 rounded-lg text-sm font-semibold inline-block ${getPortalStatusColor(
                    tenant.isActive?.status ?? true,
                  )}`}
                >
                  {getPortalStatusLabel(tenant.isActive?.status ?? true)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTogglePortalStatus}
                  disabled={isTogglingPortalStatus}
                  className="border-border bg-transparent"
                >
                  {isTogglingPortalStatus
                    ? "Updating..."
                    : (tenant.isActive?.status ?? true)
                      ? "Deactivate"
                      : "Activate"}
                </Button>
              </div>
            </div>
          </div>

          {/* Status & Property */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Property</p>
              <Link
                href={`/dashboard/properties/${tenant.propertyId}`}
                className="text-blue-600 hover:underline font-semibold text-sm"
              >
                {property?.name || "Unknown"}
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card className="border border-border">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="border-b border-border rounded-none p-0 h-auto bg-transparent">
            <TabsTrigger
              value="overview"
              className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
            >
              <FileText className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
            >
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="p-6 space-y-8">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Full Name
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {tenant.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <a
                    href={`mailto:${tenant.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {tenant.email}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone</p>
                  <a
                    href={`tel:${tenant.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {tenant.phone || "Not provided"}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Tenant Type
                  </p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                    {tenant.tenantType || "residential"}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Preferred Contact
                  </p>
                  <p className="text-foreground capitalize">
                    {tenant.preferredContactMethod || "email"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Generated Password
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-foreground font-mono">
                      {generatedPassword ?? "—"}
                    </p>
                    {generatedPassword && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassword);
                          setCopiedPassword(true);
                          setTimeout(() => setCopiedPassword(false), 2000);
                        }}
                      >
                        {copiedPassword ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      className="text-xs text-primary hover:underline ml-2"
                      onClick={async () => {
                        const newPw = await generatePassword(8);

                        if (tenant) {
                          const updated = await updateTenantApi(tenant._id, {
                            ...tenant,
                            password: newPw,
                          });
                          if (updated) setTenant(updated);
                          setGeneratedPassword(newPw);
                        }
                      }}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Preferred Name
                  </p>
                  <p className="text-foreground">
                    {tenant.preferredName || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Middle Name
                  </p>
                  <p className="text-foreground">
                    {tenant.middleName || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Gender</p>
                  <p className="text-foreground capitalize">
                    {tenant.gender || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Marital Status
                  </p>
                  <p className="text-foreground capitalize">
                    {tenant.maritalStatus || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Nationality
                  </p>
                  <p className="text-foreground">
                    {tenant.nationality || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Place of Origin
                  </p>
                  <p className="text-foreground">
                    {tenant.placeOfOrigin || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Has Family
                  </p>
                  <p className="text-foreground">
                    {tenant.hasFamily ? "Yes" : "No"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">
                    Household Members
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">
                    {Array.isArray(tenant.householdMembers)
                      ? tenant.householdMembers.join(", ")
                      : tenant.householdMembers || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Cohabitant Name
                  </p>
                  <p className="text-foreground">
                    {tenant.cohabitant?.name || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Cohabitant Relationship
                  </p>
                  <p className="text-foreground">
                    {tenant.cohabitant?.relationship || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Occupation
                  </p>
                  <p className="text-foreground">
                    {tenant.occupation || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Employer Name
                  </p>
                  <p className="text-foreground">
                    {tenant.employerName || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Position</p>
                  <p className="text-foreground">
                    {tenant.position || "Not provided"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">
                    Next of Kin
                  </p>
                  <p className="text-foreground">
                    {tenant.nextOfKin?.name || "Not provided"}
                    {tenant.nextOfKin?.relationship &&
                      ` — ${tenant.nextOfKin.relationship}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Next of Kin Phone
                  </p>
                  <p className="text-foreground">
                    {tenant.nextOfKin?.phone || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Next of Kin Email
                  </p>
                  <p className="text-foreground">
                    {tenant.nextOfKin?.email || "Not provided"}
                  </p>
                </div>
              </div>
            </div>

            {/* Property & Lease Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Home className="w-5 h-5" />
                Property & Lease Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Property</p>
                  <Link
                    href={`/dashboard/properties/${tenant.propertyId}`}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    {property?.name || "Unknown"}
                  </Link>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Unit</p>
                  <p className="text-lg font-semibold text-foreground">
                    {tenant.unitNumber || "_ _"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Monthly Rent
                  </p>
                  {(() => {
                    const rent = Number(tenant.rentAmount ?? 0);
                    const serviceFee = Number(property?.serviceFee ?? 0);
                    const total = rent + serviceFee;
                    return (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(rent, activeCurrency, undefined)} rent
                          +{" "}
                          {formatCurrency(
                            serviceFee,
                            activeCurrency,
                            undefined,
                          )}{" "}
                          service
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                          {formatCurrency(total, activeCurrency, undefined)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Lease Type
                  </p>
                  <p className="text-foreground capitalize">
                    {tenant.leaseType || "month-to-month"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Lease Start Date
                  </p>
                  <p className="text-foreground">
                    {tenant.leaseStartDate
                      ? new Date(tenant.leaseStartDate).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Lease End Date
                  </p>
                  <p className="text-foreground">
                    {leaseEnd.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Lease Terms
                  </p>
                  <p className="text-foreground">
                    {tenant.leaseTerms || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Security Deposit
                  </p>
                  <p className="text-foreground">
                    {tenant.securityDeposit || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Application Date
                  </p>
                  <p className="text-foreground">
                    {tenant.applicationDate
                      ? new Date(tenant.applicationDate).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Move-in Date
                  </p>
                  <p className="text-foreground">
                    {tenant.moveInDate
                      ? new Date(tenant.moveInDate).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Emergency Contact
                  </p>
                  <p className="text-foreground">
                    {tenant.emergencyContact || "Not provided"}
                  </p>
                </div>
                {tenant.emergencyContactName && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Emergency Contact Name
                    </p>
                    <p className="text-foreground">
                      {tenant.emergencyContactName}
                    </p>
                  </div>
                )}
                {tenant.emergencyContactPhone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Emergency Contact Phone
                    </p>
                    <a
                      href={`tel:${tenant.emergencyContactPhone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {tenant.emergencyContactPhone}
                    </a>
                  </div>
                )}
                {tenant.emergencyContactEmail && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Emergency Contact Email
                    </p>
                    <a
                      href={`mailto:${tenant.emergencyContactEmail}`}
                      className="text-blue-600 hover:underline"
                    >
                      {tenant.emergencyContactEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Residential Details - Conditional */}
            {(tenant.tenantType === "residential" ||
              tenant.tenantType === "mixed") && (
              <div className="space-y-4 border border-border rounded-lg p-4 bg-secondary/20">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Residential Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Date of Birth
                    </p>
                    <p className="text-foreground">
                      {tenant.dateOfBirth
                        ? new Date(tenant.dateOfBirth).toLocaleDateString()
                        : "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Co-signer
                    </p>
                    <p className="text-foreground">
                      {tenant.coSigner || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Employment Information
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {tenant.employmentInfo || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Previous Addresses
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {tenant.previousAddresses || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pets</p>
                    <p className="text-foreground">
                      {tenant.pets || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Vehicles
                    </p>
                    <p className="text-foreground">
                      {tenant.vehicles || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Commercial Details - Conditional */}
            {(tenant.tenantType === "commercial" ||
              tenant.tenantType === "mixed") && (
              <div className="space-y-4 border border-border rounded-lg p-4 bg-secondary/20">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  Commercial Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Business Information
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {tenant.businessInfo || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Business Contacts
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {tenant.businessContacts || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Financial Information
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {tenant.financialInfo || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Security Deposit
                    </p>
                    <p className="text-foreground">
                      {tenant.securityDeposit || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(tenant.policyGiven?.title ||
              tenant.policyGiven?.body ||
              tenant.policyExceptions) && (
              <div className="space-y-4 border border-border rounded-lg p-4 bg-secondary/20">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Tenant Policy
                </h3>
                <div className="grid grid-cols-1 gap-6">
                  {tenant.policyGiven?.title && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Assigned Policy Title
                      </p>
                      <p className="text-foreground">
                        {tenant.policyGiven.title}
                      </p>
                    </div>
                  )}
                  {tenant.policyGiven?.body && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Assigned Policy
                      </p>
                      <p className="text-foreground whitespace-pre-wrap">
                        {tenant.policyGiven.body}
                      </p>
                    </div>
                  )}
                  {tenant.policyExceptions && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Policy Exceptions
                      </p>
                      <p className="text-foreground whitespace-pre-wrap">
                        {tenant.policyExceptions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {tenant.notes && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </h3>
                <div className="bg-secondary/20 border border-border rounded-lg p-4">
                  <p className="text-foreground whitespace-pre-wrap">
                    {tenant.notes}
                  </p>
                </div>
              </div>
            )}

            {/* Status Alerts */}
            {tenant.status === "moving out" && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-200">
                    Tenant Moving Out
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-300">
                    This tenant is planning to vacate the property. Schedule an
                    exit inspection.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Monthly Rent
                  </p>
                  {(() => {
                    const rent = Number(tenant.rentAmount ?? 0);
                    const serviceFee = Number(property?.serviceFee ?? 0);
                    const total = rent + serviceFee;
                    return (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(rent, activeCurrency, undefined)} rent
                          +{" "}
                          {formatCurrency(
                            serviceFee,
                            activeCurrency,
                            undefined,
                          )}{" "}
                          service
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {formatCurrency(total, activeCurrency, undefined)}
                        </div>
                      </div>
                    );
                  })()}
                </Card>
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Annual Rent
                  </p>
                  {(() => {
                    const rent = Number(tenant.rentAmount ?? 0);
                    const serviceFee = Number(property?.serviceFee ?? 0);
                    const annual = (rent + serviceFee) * 12;
                    return (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Includes service fee ·{" "}
                          {formatCurrency(
                            rent + serviceFee,
                            activeCurrency,
                            undefined,
                          )}{" "}
                          / month
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {formatCurrency(annual, activeCurrency, undefined)}
                        </div>
                      </div>
                    );
                  })()}
                </Card>
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Total Paid
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(totalPaid, activeCurrency)}
                  </p>
                </Card>
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Payment Status
                  </p>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full inline-block ${getStatusColor(tenant.status ?? "")}`}
                  >
                    {getStatusLabel(tenant.status ?? "")}
                  </span>
                </Card>
                <RecordPaymentModal
                  open={showRecordPayment}
                  onOpenChange={(v) => setShowRecordPayment(v)}
                  tenantId={tenant?.id}
                  propertyId={tenant?.propertyId}
                />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">Payment History</h3>
                <Button size="sm" onClick={() => setShowRecordPayment(true)}>
                  Record Payment
                </Button>
              </div>

              {tenantPayments.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-secondary/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Transaction ID
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Amount
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Description
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Status
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantPayments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="border-b border-border hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-foreground font-medium">
                            {payment.transId || payment.id}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(
                                payment.amount || 0,
                                activeCurrency,
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {payment.note || payment.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded inline-flex items-center gap-1 ${
                                payment.status === "complete" ||
                                payment.status === "completed" ||
                                payment.status === "paid"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                  : payment.status === "pending" ||
                                      payment.status === "balance"
                                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              }`}
                            >
                              {(payment.status === "complete" ||
                                payment.status === "completed" ||
                                payment.status === "paid") && (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              {(payment.status === "pending" ||
                                payment.status === "balance") && (
                                <Clock className="w-3 h-3" />
                              )}
                              {payment.status === "failed" && (
                                <XCircle className="w-3 h-3" />
                              )}
                              {(payment.status || "pending")
                                .charAt(0)
                                .toUpperCase() +
                                (payment.status || "pending").slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (typeof window === "undefined") return;
                                    const w = window.open("", "_blank");
                                    if (!w) return;
                                    w.document.write(
                                      `<html><head><title>Payment ${payment.transId || payment.id}</title></head><body><pre>${JSON.stringify(payment, null, 2)}</pre></body></html>`,
                                    );
                                    w.document.close();
                                    w.print();
                                  }}
                                >
                                  <Printer className="mr-2 h-4 w-4" />
                                  Print
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      const text = `Payment ${payment.transId || payment.id}: ${formatCurrency(
                                        payment.amount || 0,
                                        activeCurrency,
                                      )}`;
                                      if (navigator.share) {
                                        await navigator.share({
                                          title: "Payment",
                                          text,
                                          url: window.location.href,
                                        });
                                      } else if (navigator.clipboard) {
                                        await navigator.clipboard.writeText(
                                          text,
                                        );
                                        alert(
                                          "Payment details copied to clipboard",
                                        );
                                      } else {
                                        alert(text);
                                      }
                                    } catch (e) {
                                      console.error("Share failed", e);
                                    }
                                  }}
                                >
                                  <Share2 className="mr-2 h-4 w-4" />
                                  Share
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : tenantPayments.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-secondary/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Transaction ID
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Amount
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Description
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantPayments.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b border-border hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-foreground font-medium">
                            {transaction.id}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(
                                transaction.amount,
                                activeCurrency,
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {transaction.description}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded inline-flex items-center gap-1 ${
                                transaction.status === "completed"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                  : transaction.status === "pending"
                                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              }`}
                            >
                              {transaction.status === "completed" && (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              {transaction.status === "pending" && (
                                <Clock className="w-3 h-3" />
                              )}
                              {transaction.status === "failed" && (
                                <XCircle className="w-3 h-3" />
                              )}
                              {(transaction.status || "pending")
                                .charAt(0)
                                .toUpperCase() +
                                (transaction.status || "pending").slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 border border-border rounded-lg bg-secondary/30">
                  <p className="text-muted-foreground">
                    No payment records found
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Maintenance Requests
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {tenant.maintainances?.length || 0}
                  </p>
                </Card>
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Messages</p>
                  <p className="text-2xl font-bold text-foreground">
                    {tenant.messages?.length || 0}
                  </p>
                </Card>
                <Card className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Reports</p>
                  <p className="text-2xl font-bold text-foreground">
                    {tenant.reports?.length || 0}
                  </p>
                </Card>
              </div>
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Document management coming soon...
                </p>

                <Button
                  className="bg-muted text-muted-foreground hover:cursor-not-allowed"
                  disabled
                >
                  Upload Document
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">
                  Tenant Communication
                </h3>
                <Button
                  className="bg-muted text-muted-foreground hover:cursor-not-allowed"
                  disabled
                  size="sm"
                >
                  <Send className="w-4 h-4 mr-2" />
                  New Message
                </Button>
              </div>
              {tenant.messages && tenant.messages.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {tenant.messages.length} message
                    {tenant.messages.length !== 1 ? "s" : ""} on record
                  </p>
                  {tenant.messages.map((msgId: string, index: number) => (
                    <div
                      key={index}
                      className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors"
                    >
                      <p className="font-semibold text-foreground text-sm">
                        {msgId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Message ID: {msgId}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquareLock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    Instant messaging coming soon...
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Edit Tenant Form */}
      <TenantForm
        mode="edit"
        initialData={{
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          tenantType: tenant.tenantType || "residential",
          propertyId: tenant.propertyId || "",
          unitNumber: tenant.unitNumber || "",
          leaseStartDate: tenant.leaseStartDate || "",
          leaseEndDate:
            tenant.leaseEndDate ||
            (tenant.leaseStartDate
              ? calculateLeaseEnd(
                  tenant.leaseStartDate,
                  tenant.leaseType || "monthly",
                )
                  .toISOString()
                  .slice(0, 10)
              : ""),
          leaseType: tenant.leaseType || "monthly",
          leaseTerms: tenant.leaseTerms || "",
          preferredContactMethod: tenant.preferredContactMethod || "email",
          applicationDate: tenant.applicationDate || "",
          moveInDate: tenant.moveInDate || "",
          password: tenant.password || "",
          monthlyRent: tenant.rentAmount ?? tenant.monthlyRent ?? 0,
          emergencyContact: tenant.emergencyContact || "",
          notes: tenant.notes || "",
          dateOfBirth: tenant.dateOfBirth || "",
          employmentInfo: tenant.employmentInfo || "",
          previousAddresses: tenant.previousAddresses || "",
          coSigner: tenant.coSigner || "",
          pets: tenant.pets || "",
          vehicles: tenant.vehicles || "",
          businessInfo: tenant.businessInfo || "",
          businessContacts: tenant.businessContacts || "",
          financialInfo: tenant.financialInfo || "",
          securityDeposit: tenant.securityDeposit || "",
        }}
        renewalDateHint={leaseRenewalHint}
        isOpen={isEditOpen}
        isLoading={isEditingTenant}
        onClose={() => setIsEditOpen(false)}
        onSubmit={async (formData) => {
          try {
            setIsEditingTenant(true);
            const updatedTenant = {
              ...tenant,
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              preferredName: formData.preferredName,
              middleName: formData.middleName,
              gender: formData.gender,
              maritalStatus: formData.maritalStatus,
              nationality: formData.nationality,
              placeOfOrigin: formData.placeOfOrigin,
              hasFamily: formData.hasFamily === "yes",
              householdMembers: formData.householdMembers
                ? formData.householdMembers.split("\n").filter(Boolean)
                : undefined,
              cohabitant: {
                name: formData.cohabitantName,
                relationship: formData.cohabitantRelationship,
              },
              occupation: formData.occupation,
              employerName: formData.employerName,
              position: formData.position,
              nextOfKin: {
                name: formData.nextOfKinName,
                relationship: formData.nextOfKinRelationship,
                phone: formData.nextOfKinPhone,
                email: formData.nextOfKinEmail,
              },
              tenantType: formData.tenantType,
              propertyId: formData.propertyId,
              unitNumber: formData.unitNumber,
              leaseStartDate: formData.leaseStartDate,
              leaseEndDate: formData.leaseEndDate,
              leaseType: formData.leaseType,
              leaseTerms: formData.leaseTerms,
              preferredContactMethod: formData.preferredContactMethod,
              applicationDate: formData.applicationDate,
              moveInDate: formData.moveInDate,
              password: formData.password,
              rentAmount:
                formData.monthlyRent === "" ? 0 : Number(formData.monthlyRent),
              monthlyRent:
                formData.monthlyRent === "" ? 0 : Number(formData.monthlyRent),
              emergencyContact: formData.emergencyContact,
              notes: formData.notes,
              dateOfBirth: formData.dateOfBirth,
              employmentInfo: formData.employmentInfo,
              previousAddresses: formData.previousAddresses,
              coSigner: formData.coSigner,
              pets: formData.pets,
              vehicles: formData.vehicles,
              businessInfo: formData.businessInfo,
              businessContacts: formData.businessContacts,
              financialInfo: formData.financialInfo,
              securityDeposit: formData.securityDeposit,
            };
            const savedTenant = await updateTenantApi(
              updatedTenant.id || updatedTenant._id || "",
              updatedTenant,
            );
            if (savedTenant) {
              const changedFields = Object.entries(updatedTenant)
                .filter(([key, value]) => (tenant as any)[key] !== value)
                .map(([key]) => key);

              if (changedFields.length > 0) {
                notifyTenantProfileUpdateToAdmin(
                  `${tenant.name || tenant.email || "Tenant"}`,
                  changedFields,
                );
              }

              setTenant(savedTenant);
            }
            setIsEditOpen(false);
          } catch (error) {
            console.error("Error updating tenant:", error);
          } finally {
            setIsEditingTenant(false);
          }
        }}
      />
    </div>
  );
}
