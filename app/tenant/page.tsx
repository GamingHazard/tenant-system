"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Wrench,
  Phone,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  House,
  HourglassIcon,
  LucideHourglass,
} from "lucide-react";
import LeaseEndDisplay from "@/components/ui/lease-end-display";
import { useTenantContext } from "@/lib/tenant-context";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import { useTenantPortalFeatures } from "@/lib/hooks/use-tenant-portal-features";

export default function TenantDashboard() {
  const {
    currentTenant: tenant,
    currentProperty: propertyInfo,
    payments: tenantPayments,
    maintenanceRequests: tenantMaintenanceData,
  } = useTenantContext();
  const activeCurrency = useActiveCurrency();
  const { features, isLoaded } = useTenantPortalFeatures();
  const showPaymentAndMaintenance =
    isLoaded && features.paymentPortal && features.maintenanceRequests;

  // Get payment history (transactions)
  const paymentHistory = tenantPayments || [];

  // Get maintenance requests
  const tenantMaintenance = tenant ? tenantMaintenanceData : [];

  const latestPayment = paymentHistory.length > 0 ? paymentHistory[0] : null;
  const pendingMaintenance = tenantMaintenance.filter(
    (r) => r.status !== "completed",
  );

  const formatPaymentMethodLabel = (method?: string | null) => {
    if (!method) return "_ _";
    const m = String(method).trim();
    if (!m) return "_ _";
    const map: Record<string, string> = {
      MTN_MoMo: "MTN MoMo",
      Airtel_Money: "Airtel Money",
      Orange_Money: "Orange Money",
      Visa_Mastercard: "Credit / Debit Card",
      Bank_Transfer: "Bank Transfer",
      bank_transfer: "Bank Transfer",
      card: "Credit / Debit Card",
      visa: "Visa / Mastercard",
      mastercard: "Visa / Mastercard",
      Paystack: "Paystack",
      mobile_money: "Mobile Money",
      mobilemoney: "Mobile Money",
    };
    return map[m] || map[m.toLowerCase()] || m.replace(/_/g, " ");
  };

  const latestPaymentMethodLabel = formatPaymentMethodLabel(
    latestPayment?.paymentMethod || latestPayment?.method || null,
  );

  // Calculate lease expiration date
  const getLeaseExpiration = () => {
    const leaseStart = tenant?.leaseStartDate;
    if (!leaseStart) return null;

    const startDate = new Date(leaseStart);
    const leaseType = tenant?.leaseType || "month-to-month";

    if (leaseType === "month-to-month" || leaseType === "monthly") {
      // For monthly leases, add exactly one month to the start date
      return new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        startDate.getDate(),
      );
    } else if (leaseType.includes("month")) {
      // Parse "6-month", "12-month", etc.
      const months = parseInt(leaseType.split("-")[0]);
      if (!isNaN(months)) {
        return new Date(
          startDate.getFullYear(),
          startDate.getMonth() + months,
          startDate.getDate(),
        );
      }
    } else if (leaseType.includes("year")) {
      // Parse "1-year", "2-year", etc.
      const years = parseInt(leaseType.split("-")[0]);
      if (!isNaN(years)) {
        return new Date(
          startDate.getFullYear() + years,
          startDate.getMonth(),
          startDate.getDate(),
        );
      }
    }

    return null;
  };

  const leaseExpiration = getLeaseExpiration();

  // Calculate days remaining in lease
  const getDaysRemaining = () => {
    if (!leaseExpiration) return null;
    const today = new Date();
    const timeDiff = leaseExpiration.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const daysRemaining = getDaysRemaining();

  // Calculate months remaining for display
  const getMonthsRemaining = () => {
    if (!daysRemaining) return null;
    return Math.floor(daysRemaining / 30);
  };

  const monthsRemaining = getMonthsRemaining();

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Welcome, {tenant?.name || "Tenant"}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Unit {tenant?.unitNumber || "N/A"} •{" "}
          {propertyInfo?.name || "Property"}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Current Rent */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Monthly Rent
              </p>
              {(() => {
                const rent = Number(tenant?.rentAmount ?? 0);
                const serviceFee = Number(propertyInfo?.serviceFee ?? 0);
                const total = rent + serviceFee;
                return (
                  <div>
                    <p
                      className={`${String(formatCurrency(total, activeCurrency)).length > 6 ? "md:text-lg text-sm" : "text-lg md:text-sm"} font-bold text-foreground`}
                    >
                      {formatCurrency(total, activeCurrency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      rent. {formatCurrency(rent, activeCurrency)} <br />
                      service · {formatCurrency(serviceFee, activeCurrency)}
                    </p>
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-2">
                Lease Started on:{" "}
                {tenant?.leaseStartDate
                  ? new Date(tenant?.leaseStartDate).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div className="w-10 absolute top-1 right-1 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <House className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Last Payment Method */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Outstanding Balance
              </p>
              <p className="text-2xl md:text-3xl font-bold text-red-600">
                {latestPayment?.balance
                  ? `${getCurrencySymbol(activeCurrency)} ${latestPayment.balance.toLocaleString()}`
                  : `${getCurrencySymbol(activeCurrency)} 0`}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {latestPayment?.status === "completed"
                  ? `Paid on: ${latestPayment?.paidOn ? new Date(latestPayment.paidOn).toLocaleDateString() : "N/A"}`
                  : `Last Payed On: ${latestPayment?.createdAt ? new Date(new Date(latestPayment?.createdAt).getFullYear(), new Date(latestPayment?.createdAt).getMonth() + 1, new Date(latestPayment?.createdAt).getDate()).toLocaleDateString() : "N/A"}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last payment amount:{" "}
                {latestPayment?.amount
                  ? `${getCurrencySymbol(activeCurrency)} ${latestPayment.amount.toLocaleString()}`
                  : `${getCurrencySymbol(activeCurrency)} 0`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last payment method: {latestPaymentMethodLabel}
              </p>
            </div>
            <div className="w-10 h-10 absolute top-1 right-1 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Lease Status */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Lease Expires
              </p>
              <LeaseEndDisplay
                tenant={tenant}
                onRenew={() => {
                  /* TODO: navigate to contact */
                }}
              />
            </div>
            <div className="w-10 h-10 absolute top-1 right-1 md:w-12 md:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <LucideHourglass className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        {/* Open Maintenance */}
        {showPaymentAndMaintenance && (
          <Card className="border relative border-border p-4 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Open Requests
                </p>
                <p className="text-2xl md:text-3xl font-bold text-yellow-600">
                  {pendingMaintenance.length}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {
                    pendingMaintenance.filter((r) => r.priority === "high")
                      .length
                  }{" "}
                  urgent
                </p>
              </div>
              <div className="w-10 h-10 absolute top-1 right-1 md:w-12 md:h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Wrench className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      {showPaymentAndMaintenance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Button
            asChild
            className="bg-muted hover:bg-muted/90 text-muted-foreground h-14 md:h-12"
          >
            <Link href="#" className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Make Payment
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>
          </Button>

          <Button
            asChild
            className="bg-primary hover:bg-primary/90 text-white h-14 md:h-12"
          >
            <Link
              href="/tenant/maintenance"
              className="flex items-center gap-2"
            >
              <Wrench className="w-5 h-5" />
              Report Maintenance
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>
          </Button>
        </div>
      )}

      {/* Recent Activity */}
      {showPaymentAndMaintenance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {/* Recent Payments */}
          <Card className="border border-border p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold text-foreground">
                Recent Payments
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="secondary" asChild className="h-10">
                  <Link
                    href="/tenant/make-payment"
                    className="flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pay Rent
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  asChild
                  className="text-primary hover:text-primary/90 h-10"
                >
                  <Link href="/tenant/payments">View All</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {paymentHistory
                .slice(-3)
                .reverse()
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(payment.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment?.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-foreground">
                        {getCurrencySymbol(activeCurrency)}{" "}
                        {payment.amount.toLocaleString()}
                      </p>
                      <Badge
                        className={`${
                          String(payment.status).toLowerCase() === "paid"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Open Maintenance Requests */}
          <Card className="border border-border p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold text-foreground">
                Maintenance Requests
              </h2>
              <Button
                variant="ghost"
                asChild
                className="text-primary hover:text-primary/90"
              >
                <Link href="/tenant/maintenance">View All</Link>
              </Button>
            </div>

            <div className="space-y-3">
              {pendingMaintenance.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-sm text-muted-foreground">
                    No pending maintenance requests.
                  </p>
                  <img
                    src="/no-maintenance2.png"
                    alt="No pending requests"
                    className="w-[200px] h-[250px] text-muted-foreground"
                  />
                </div>
              ) : (
                pendingMaintenance.slice(0, 3).map((request) => (
                  <div
                    key={request.id}
                    className="p-3 bg-secondary rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          request.priority === "high"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-yellow-100 dark:bg-yellow-900/30"
                        }`}
                      >
                        {request.status === "assigned" ? (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {request.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {request.status.charAt(0).toUpperCase() +
                            request.status.slice(1)}
                        </p>
                      </div>
                      <Badge className="text-xs whitespace-nowrap">
                        {request.priority}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Important Notice */}
      <Card className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900/30 p-4 md:p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-yellow-900 dark:text-yellow-200">
              Lease Status
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-2">
              {leaseExpiration ? (
                <>
                  Your {tenant?.leaseType || "month-to-month"} lease expires on{" "}
                  <span className="font-semibold">
                    {leaseExpiration.toLocaleDateString()}
                  </span>
                  {daysRemaining &&
                    monthsRemaining !== null &&
                    daysRemaining > 0 && (
                      <>
                        {" "}
                        — {monthsRemaining} months and {daysRemaining % 30} days
                        remaining
                      </>
                    )}
                  {daysRemaining && daysRemaining <= 0 && (
                    <> — Your lease has expired</>
                  )}
                  . Please contact management if you have any questions about
                  renewal or modifications.
                </>
              ) : (
                "Please contact management for information about your lease status."
              )}
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 border-yellow-600 text-yellow-600 hover:bg-yellow-100 bg-transparent"
            >
              <Link href="/tenant/contact">Contact Management</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
