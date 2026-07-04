"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAppData } from "@/lib/data-context";
import { getAllExpenses } from "@/lib/services/expenses";
import { listPaymentsApi } from "@/lib/services/payments";
import { listAuditLogs } from "@/lib/services/audit";
import {
  AdminSkeletonHeader,
  AdminTableSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Home,
  DollarSign,
  AlertCircle,
  Wrench,
  TrendingUp,
  ArrowRight,
  Users,
  MapPin,
} from "lucide-react";
import {
  formatCurrency,
  getCurrencySymbol,
  getLocaleForCurrency,
} from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import PropertyPerformanceGrouped from "@/components/charts/property-performance-grouped";
import RentCollectionProgress from "@/components/charts/rent-collection-progress";
import PropertyCategoryDistributionRing from "@/components/charts/tenant-distribution-ring";
import MaintenanceAnalyticsRing from "@/components/charts/maintenance-analytics-ring";
import MaintenanceTrendsLine from "@/components/charts/maintenance-trends-line";
import MaintenanceCostBar from "@/components/charts/maintenance-cost-bar";
import TenantAnalyticsBar from "@/components/charts/tenant-analytics-bar";
import LeaseExpiryTimeline from "@/components/charts/lease-expiry-timeline";
export default function DashboardPage() {
  const router = useRouter();

  // State for real data
  const {
    properties,
    tenants,
    payments,
    expenses,
    maintenanceRequests,
    isLoading,
    isFetching,
    isInitialDataLoading,
    isPaymentsLoading,
    isExpensesLoading,
    isPaymentsInitialLoading,
    isExpensesInitialLoading,
    refetchAll,
    paymentsError,
    expensesError,
  } = useAppData();
  const { token } = useAuth();

  const dashboardPaymentsQuery = useQuery({
    queryKey: ["dashboardPayments", token || ""],
    queryFn: async () =>
      listPaymentsApi({
        token: token ?? undefined,
        limit: 1000,
        sort: "-paidOn",
      }),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const dashboardExpensesQuery = useQuery({
    queryKey: ["dashboardExpenses", token || ""],
    queryFn: async () =>
      getAllExpenses({
        token: token ?? undefined,
        limit: 1000,
        sort: "-date",
      }),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const dashboardActivityQuery = useQuery({
    queryKey: ["dashboardActivity", token || ""],
    queryFn: async () => listAuditLogs(),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchInterval: 10000,
  });

  const paymentsData = dashboardPaymentsQuery.data ?? payments;
  const expensesData = dashboardExpensesQuery.data ?? expenses;
  const activityEntries = dashboardActivityQuery.data ?? [];
  const [isHydrated, setIsHydrated] = useState(false);
  const activeCurrency = useActiveCurrency();

  const formatWholeCurrency = (value: number) => {
    const code = String(activeCurrency || "USD").toUpperCase();
    const locale = getLocaleForCurrency(code);
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  };

  const [viewMode, setViewMode] = useState<"occupancy" | "performance">(
    "occupancy",
  );
  const [revenueWindow, setRevenueWindow] = useState<number>(6);
  const [revenueMode, setRevenueMode] = useState<"monthly" | "cumulative">(
    "monthly",
  );
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(true);
  const isPageLoading = !isHydrated || isInitialDataLoading;
  // Show skeletons for finance cards while auth/initial queries are resolving
  const showPaymentCardSkeleton = isPageLoading || isPaymentsInitialLoading;
  const showFinancialCardSkeleton =
    isPageLoading || isPaymentsInitialLoading || isExpensesInitialLoading;

  // Load real data on mount
  useEffect(() => {
    setIsHydrated(true);

    const refreshHandler = () => {
      refetchAll();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("paymentsUpdated", refreshHandler);
      window.addEventListener("expensesUpdated", refreshHandler);
      window.addEventListener("maintenanceUpdated", refreshHandler);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("paymentsUpdated", refreshHandler);
        window.removeEventListener("expensesUpdated", refreshHandler);
        window.removeEventListener("maintenanceUpdated", refreshHandler);
      }
    };
  }, [refetchAll]);

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    const totalProperties = properties.length;
    const totalUnits = properties.reduce(
      (sum, p) => sum + Number(p.units?.length ?? p.units_available ?? 0),
      0,
    );

    const now = new Date();
    const currentMonthKey = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    const currentYear = now.getUTCFullYear();

    const revenueStatuses = new Set([
      "complete",
      "completed",
      "paid",
      "balance",
      "recorded",
      "confirmed",
      "settled",
      "success",
    ]);

    const normalizeNumber = (value: unknown) => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num : 0;
    };

    const normalizePaymentKey = (value: unknown) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");

    const getUnitRent = (property: any, unit: any) => {
      if (typeof unit === "object" && unit !== null) {
        return normalizeNumber(
          (unit as any).rent ??
            (unit as any).price ??
            (unit as any).monthlyRent ??
            property.price_per_unit ??
            (property as any).monthlyRent ??
            0,
        );
      }

      return normalizeNumber(
        property.price_per_unit ?? (property as any).monthlyRent ?? 0,
      );
    };

    const countPropertyUnits = (property: any) => {
      if (Array.isArray(property.units) && property.units.length > 0) {
        return property.units.length;
      }

      if (typeof property.customUnitNumbers === "string") {
        return property.customUnitNumbers
          .split(/[,\n]/)
          .map((item: string) => item.trim())
          .filter(Boolean).length;
      }

      return (
        Number(property.units_available ?? property.units?.length ?? 0) || 0
      );
    };

    const totalExpectedRent = properties.reduce((sum, property) => {
      const units = Array.isArray(property.units) ? property.units : [];
      if (units.length > 0) {
        return (
          sum +
          units.reduce(
            (unitSum, unit) => unitSum + getUnitRent(property, unit),
            0,
          )
        );
      }

      const unitCount = countPropertyUnits(property);
      const unitRent = normalizeNumber(
        property.price_per_unit ?? (property as any).monthlyRent ?? 0,
      );
      return sum + unitRent * unitCount;
    }, 0);

    const monthlyPaymentRevenue = paymentsData.reduce((sum, payment) => {
      const status = String(payment.status || "").toLowerCase();
      if (!revenueStatuses.has(status)) return sum;
      const paymentDate =
        payment.date ||
        payment.paymentDate ||
        payment.paidOn ||
        payment.createdAt;
      const date = new Date(String(paymentDate || ""));
      if (Number.isNaN(date.getTime())) return sum;
      const monthKey = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, "0")}`;
      if (monthKey !== currentMonthKey) return sum;
      return (
        sum + normalizeNumber(payment.amount ?? payment.total ?? payment.value)
      );
    }, 0);

    const totalMonthlyRevenue = monthlyPaymentRevenue;

    const totalYtdRevenue = paymentsData.reduce((sum, payment) => {
      const status = String(payment.status || "").toLowerCase();
      if (!revenueStatuses.has(status)) return sum;
      const paymentDate =
        payment.date ||
        payment.paymentDate ||
        payment.paidOn ||
        payment.createdAt;
      const date = new Date(String(paymentDate || ""));
      if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== currentYear)
        return sum;
      return (
        sum + normalizeNumber(payment.amount ?? payment.total ?? payment.value)
      );
    }, 0);

    const totalCollectedRent = paymentsData.reduce((sum, payment) => {
      const status = String(payment.status || "").toLowerCase();
      if (!revenueStatuses.has(status)) return sum;
      const reason = normalizePaymentKey(payment.reasonForPayment);
      const paymentType = normalizePaymentKey(payment.paymentType);
      const isRentRelated =
        reason.includes("rent") ||
        reason.includes("balance") ||
        paymentType.includes("rent") ||
        paymentType.includes("balance");
      if (!isRentRelated) return sum;
      return (
        sum + normalizeNumber(payment.amount ?? payment.total ?? payment.value)
      );
    }, 0);

    const totalExpenses = expensesData.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0,
    );
    const ytdProfit = totalYtdRevenue - totalExpenses;

    const outstandingTenants = tenants.filter(
      (tenant) => Number(tenant.currentBalance ?? 0) > 0,
    );
    const pendingPayments = outstandingTenants.length;
    const pendingBalanceTotal = outstandingTenants.reduce(
      (sum, tenant) => sum + Number(tenant.currentBalance ?? 0),
      0,
    );

    const averageOccupancy =
      properties.length > 0
        ? Math.round((tenants.length / totalUnits) * 100 * 100) / 100
        : 0;

    // Count open maintenance requests
    const openMaintenanceRequests = maintenanceRequests.filter(
      (req) => req.status === "pending",
    ).length;

    return {
      totalProperties,
      totalUnits,
      totalMonthlyRevenue,
      averageOccupancy,
      pendingPayments,
      pendingBalanceTotal,
      openMaintenanceRequests,
      totalExpenses,
      ytdProfit,
      expectedRent: totalExpectedRent,
      collectedRent: totalCollectedRent,
    };
  }, [properties, tenants, paymentsData, maintenanceRequests, expensesData]);

  // Prepare chart data from real data: monthly revenue/expenses, fill missing months
  const chartData = useMemo(() => {
    const months = revenueWindow; // last N months
    const now = new Date();

    // Build ordered month keys for the window
    const monthKeys = Array.from({ length: months }).map((_, i) => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1),
      );
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      return { key, label, date: d };
    });

    const map: Record<string, { revenue: number; expenses: number }> = {};

    paymentsData.forEach((payment) => {
      if (!payment) return;
      const paymentDate =
        payment.date ||
        payment.paymentDate ||
        payment.paidOn ||
        payment.createdAt;
      if (!paymentDate) return;
      const d = new Date(paymentDate);
      if (isNaN(d.getTime())) return;
      const k = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 7);
      if (!map[k]) map[k] = { revenue: 0, expenses: 0 };
      const normalizedStatus = String(payment.status || "").toLowerCase();
      const isRevenue = [
        "complete",
        "completed",
        "paid",
        "balance",
        "recorded",
        "confirmed",
        "settled",
        "success",
      ].includes(normalizedStatus);
      if (isRevenue) {
        const rawAmount =
          (payment as any).amount ??
          (payment as any).total ??
          (payment as any).value ??
          (payment as any).paymentAmount ??
          (payment as any).amountPaid ??
          0;
        const amount = Number(String(rawAmount).replace(/[^0-9.-]+/g, "")) || 0;
        map[k].revenue += amount;
      }
    });

    expensesData.forEach((expense) => {
      if (!expense) return;
      const expenseDate =
        expense.date ||
        expense.createdAt ||
        (expense as any).transactionDate ||
        (expense as any).postedAt ||
        (expense as any).entryDate;
      if (!expenseDate) return;
      const d = new Date(expenseDate);
      if (isNaN(d.getTime())) return;
      const k = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 7);
      if (!map[k]) map[k] = { revenue: 0, expenses: 0 };
      const rawAmount =
        (expense as any).amount ??
        (expense as any).total ??
        (expense as any).value ??
        (expense as any).paymentAmount ??
        (expense as any).expenseAmount ??
        0;
      const amount = Number(String(rawAmount).replace(/[^0-9.-]+/g, "")) || 0;
      map[k].expenses += amount;
    });

    const result = monthKeys.map(({ key, label }) => ({
      month: label,
      revenue: Math.round(map[key]?.revenue || 0),
      expenses: Math.round(map[key]?.expenses || 0),
    }));

    return result;
  }, [payments, expenses, revenueWindow]);

  const hasCashFlowData = chartData.some(
    (item) => item.revenue > 0 || item.expenses > 0,
  );

  // Helper: moving average
  function movingAverage(values: number[], windowSize = 3) {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = window.reduce((s, v) => s + v, 0) / window.length;
      result.push(Math.round(avg));
    }
    return result;
  }

  const revenueSeries = useMemo(() => {
    const revenueValues = chartData.map((d) => d.revenue);
    const ma = movingAverage(revenueValues, 3);
    const cumulative = revenueValues.reduce((acc: number[], v, i) => {
      acc.push(v + (acc[i - 1] || 0));
      return acc;
    }, [] as number[]);

    return chartData.map((d, i) => ({
      month: d.month,
      revenue: d.revenue,
      revenueMA: ma[i],
      revenueCumulative: cumulative[i],
      expenses: d.expenses,
    }));
  }, [chartData]);

  // Prepare occupancy data for chart
  const occupancyData = useMemo(() => {
    return properties.map((property) => {
      const propertyTenants = tenants.filter(
        (t) => t.propertyId === property.id,
      );
      const units = Number(
        property.units_available ?? property.units?.length ?? 0,
      );
      const occupancyRate =
        units > 0 ? Math.round((propertyTenants.length / units) * 100) : 0;

      return {
        property: property.name || "Property",
        occupancy: occupancyRate,
      };
    });
  }, [properties, tenants]);

  // Prepare combined occupancy + performance data
  const combinedData = useMemo(() => {
    return properties.map((property) => {
      const propertyTenants = tenants.filter(
        (t) => t.propertyId === property.id,
      );
      const occupancyRate =
        property.units_available > 0
          ? Math.round(
              (propertyTenants.length / property.units_available) * 100,
            )
          : 0;

      const propPayments = payments.filter(
        (p) => p.propertyId === property.id && p.status === "complete",
      );
      const revenue = propPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const units = property.units_available || property.units?.length || 1;
      const performance = units > 0 ? Math.round(revenue / units) : 0;

      return {
        property: property.name || "Unknown",
        occupancy: occupancyRate,
        performance,
      };
    });
  }, [properties, tenants, payments]);

  // Calculate property category distribution by counting properties in each category
  const propertyCategoryDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};

    properties.forEach((property) => {
      const category = property.category || "other";
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return distribution;
  }, [properties]);

  // Calculate maintenance requests by status
  const maintenanceByStatus = useMemo(() => {
    const breakdown: Record<string, number> = {
      pending: 0,
      approved: 0,
      completed: 0,
      rejected: 0,
      on_hold: 0,
    };

    maintenanceRequests.forEach((request) => {
      const status = request.status || "pending";
      if (breakdown.hasOwnProperty(status)) {
        breakdown[status]++;
      }
    });

    return breakdown;
  }, [maintenanceRequests]);

  // Prepare expense breakdown from real expenses grouped by category
  const expenseBreakdown = useMemo(() => {
    const categoryMap: Record<string, number> = {};

    expenses.forEach((expense) => {
      const category = expense.category || "Other";
      categoryMap[category] =
        (categoryMap[category] || 0) + Number(expense.amount || 0);
    });

    if (Object.keys(categoryMap).length === 0) {
      return [];
    }

    const totalExpenses = Object.values(categoryMap).reduce(
      (sum, val) => sum + val,
      0,
    );
    if (totalExpenses === 0) {
      return [];
    }

    const colorMap: Record<string, string> = {
      maintenance: "#8884d8",
      utilities: "#82ca9d",
      insurance: "#ffc658",
      rent: "#ff7c7c",
      repairs: "#a4de6c",
      cleaning: "#d084d0",
      management: "#ffc069",
    };

    return Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: Math.round(amount),
        fill: colorMap[name.toLowerCase()] || "#8884d8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Prepare recent activity from persisted audit logs
  const recentActivity = useMemo(() => {
    return activityEntries.slice(0, 6).map((entry) => {
      const action = String(entry.action || "activity").toLowerCase();
      const isPayment = action.includes("payment");
      const isExpense = action.includes("expense");
      const isProperty = action.includes("property");
      const isTenant = action.includes("tenant");
      const isMaintenance = action.includes("maintenance");

      let title = entry.details || "System activity";
      let type: "payment" | "expense" | "property" | "tenant" | "maintenance" =
        "property";
      let amountLabel = "";

      if (isPayment) {
        type = "payment";
        title = entry.details || "Payment activity";
      } else if (isExpense) {
        type = "expense";
        title = entry.details || "Expense activity";
      } else if (isMaintenance) {
        type = "maintenance";
        title = entry.details || "Maintenance activity";
      } else if (isTenant) {
        type = "tenant";
        title = entry.details || "Tenant activity";
      } else if (isProperty) {
        type = "property";
        title = entry.details || "Property activity";
      }

      const dateLabel = entry.createdAt
        ? new Date(entry.createdAt).toLocaleDateString()
        : "Recently updated";

      return {
        id: entry.id || entry.resourceId || `${entry.action}-${dateLabel}`,
        type,
        title,
        property: entry.resourceType || "System",
        amount: 0,
        date: dateLabel,
        description: entry.details || "Activity recorded",
      };
    });
  }, [activityEntries]);

  if (isPageLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <AdminSkeletonHeader />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border border-border p-4 md:p-6">
              <Skeleton className="h-5 w-1/2 mb-4 rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-7 w-3/4 rounded-xl" />
                <Skeleton className="h-5 w-1/2 rounded-xl" />
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.7fr_1.3fr]">
          <Card className="border border-border p-6">
            <Skeleton className="h-6 w-1/3 rounded-xl mb-4" />
            <Skeleton className="h-72 rounded-3xl" />
          </Card>
          <Card className="border border-border p-6">
            <Skeleton className="h-6 w-1/3 rounded-xl mb-4" />
            <AdminTableSkeleton rowCount={4} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Welcome back
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Here's what's happening with your properties today
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {/* Total Properties */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Total Properties
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {isHydrated ? metrics.totalProperties : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {isHydrated ? `${metrics.totalUnits} units total` : "—"}
              </p>
            </div>
            <div className="w-10 absolute top-2 right-2 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
          </div>
        </Card>

        {/* Occupancy Rate */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Occupancy Rate
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {isHydrated ? `${metrics.averageOccupancy}%` : "—"}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Based on current tenants
              </p>
            </div>
            <div className="w-10 absolute top-2 right-2 h-10 md:w-12 md:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Home className="w-5  h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Monthly Revenue */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                This Month's Revenue
              </p>
              <p className="text-2xl md:text-xl font-bold text-foreground">
                {showPaymentCardSkeleton ? (
                  <span className="inline-block">
                    <Skeleton className="h-10 w-32 rounded-xl" />
                  </span>
                ) : (
                  formatCurrency(metrics.totalMonthlyRevenue, activeCurrency)
                )}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Includes completed and partial rent payments this month
              </p>
            </div>
            <div className="w-10 absolute top-2 right-2 h-10 md:w-12 md:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Pending Payments */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Pending Payments
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {showPaymentCardSkeleton ? (
                  <span className="inline-block">
                    <Skeleton className="h-10 w-16 rounded-xl" />
                  </span>
                ) : (
                  metrics.pendingPayments
                )}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Balance due:{" "}
                {showPaymentCardSkeleton ? (
                  <span className="inline-block align-text-bottom">
                    <Skeleton className="h-5 w-24 rounded-xl" />
                  </span>
                ) : (
                  formatCurrency(metrics.pendingBalanceTotal, activeCurrency)
                )}
              </p>
            </div>
            <div className="w-10 absolute top-2 right-2 h-10 md:w-12 md:h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </Card>

        {/* Open Maintenance */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                Open Maintenance
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {isHydrated ? metrics.openMaintenanceRequests : "—"}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Pending requests
              </p>
            </div>
            <div className="w-10 absolute top-2 right-2 h-10 md:w-12 md:h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wrench className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        {/* YTD Profit */}
        <Card className="border relative border-border p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">
                YTD Profit
              </p>
              <p className="text-lg md:text-sm font-bold text-foreground">
                {showFinancialCardSkeleton ? (
                  <Skeleton className="h-7 w-32 rounded-xl" />
                ) : (
                  formatCurrency(metrics.ytdProfit, activeCurrency)
                )}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                After estimated expenses
              </p>
            </div>
            <div className="w-10 absolute top-2 right-2 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {(paymentsError || expensesError) && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          {paymentsError && (
            <p className="mb-1">Payments load error: {paymentsError}</p>
          )}
          {expensesError && <p>Expenses load error: {expensesError}</p>}
        </div>
      )}

      {/* Quick Actions */}
      <Card className="border border-border p-6">
        <h2 className="text-lg font-bold text-foreground mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-white justify-start"
            onClick={() => router.push("/dashboard/properties")}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Add Property
          </Button>
          <Button
            variant="outline"
            className="w-full border-border text-foreground justify-start bg-transparent"
            onClick={() => router.push("/dashboard/finances")}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
          <Button
            variant="outline"
            className="w-full border-border text-foreground justify-start bg-transparent"
            onClick={() => router.push("/dashboard/maintenance")}
          >
            <Wrench className="w-4 h-4 mr-2" />
            Create Work Order
          </Button>
          <Button
            variant="outline"
            className="w-full border-border text-foreground justify-start bg-transparent"
            onClick={() => router.push("/dashboard/tenants")}
          >
            <Users className="w-4 h-4 mr-2" />
            Add Tenant
          </Button>
          {/* <Button
            variant="outline"
            className="w-full border-border text-foreground justify-start bg-transparent"
            onClick={() => router.push("/dashboard/map")}
          >
            <MapPin className="w-4 h-4 mr-2" />
            View Properties Map
          </Button> */}
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="border border-border p-6 lg:max-h-[500px] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
        </div>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No recent activity yet. Create or update records to populate this
              feed.
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {activity.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activity.property}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${activity.type === "payment" ? "text-green-600" : activity.type === "expense" ? "text-red-600" : "text-foreground"}`}
                  >
                    {activity.type === "payment"
                      ? "Payment"
                      : activity.type === "expense"
                        ? "Expense"
                        : activity.type === "maintenance"
                          ? "Maintenance"
                          : activity.type === "tenant"
                            ? "Tenant"
                            : "Property"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.date}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Occupancy & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
        {/* Occupancy by Property */}
        <div className="lg:col-span-2">
          <Card className="border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-6">
              Occupancy by Property
            </h2>
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant={viewMode === "occupancy" ? undefined : "outline"}
                onClick={() => setViewMode("occupancy")}
              >
                Occupancy
              </Button>
              <Button
                variant={viewMode === "performance" ? undefined : "outline"}
                onClick={() => setViewMode("performance")}
              >
                Occupancy + Performance
              </Button>
            </div>

            {occupancyData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No property data available</p>
                  <p className="text-sm">
                    Add properties and tenants to see occupancy rates
                  </p>
                </div>
              </div>
            ) : viewMode === "occupancy" ? (
              <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={occupancyData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 80 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="property"
                      stroke="var(--border)"
                      tickLine={{ stroke: "var(--border)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 11,
                      }}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={80}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(tick) => `${tick}%`}
                      stroke="var(--border)"
                      tickLine={{ stroke: "var(--border)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 11,
                      }}
                      width={50}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, "Occupancy"]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                      cursor={{ fill: "rgba(37, 99, 235, 0.1)" }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      wrapperStyle={{ color: "var(--muted-foreground)" }}
                    />
                    <Bar
                      dataKey="occupancy"
                      name="Occupancy %"
                      fill="#2563eb"
                      radius={[8, 8, 0, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <PropertyPerformanceGrouped data={combinedData} />
            )}
          </Card>
        </div>
      </div>

      {/* Cash Flow Trend */}
      <Card className="border border-border p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
          Cash Flow Trend
        </h2>

        {!hasCashFlowData ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No payment data available</p>
              <p className="text-sm">Add payments to see cash flow trends</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="month"
                  stroke="var(--border)"
                  tickLine={{ stroke: "var(--border)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={50}
                />
                <YAxis
                  yAxisId="left"
                  stroke="var(--border)"
                  tickLine={{ stroke: "var(--border)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                  tickFormatter={(value) =>
                    formatWholeCurrency(Number(value ?? 0))
                  }
                />
                <YAxis yAxisId="right" hide />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value ?? 0), activeCurrency),
                    String(name).toLowerCase().includes("revenue")
                      ? "Revenue"
                      : "Expenses",
                  ]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--foreground)",
                  }}
                  cursor={{
                    stroke: "var(--border)",
                    strokeDasharray: "3 3",
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ color: "var(--muted-foreground)" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ fill: "#16a34a", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ fill: "#dc2626", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2">
          <Card className="border border-border p-4 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
              Revenue Trend
            </h2>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={revenueMode === "monthly" ? undefined : "outline"}
                  onClick={() => setRevenueMode("monthly")}
                >
                  Monthly
                </Button>
                <Button
                  variant={revenueMode === "cumulative" ? undefined : "outline"}
                  onClick={() => setRevenueMode("cumulative")}
                >
                  Cumulative
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground mr-2">
                  Show MA
                </label>
                <input
                  type="checkbox"
                  checked={showMovingAverage}
                  onChange={(e) => setShowMovingAverage(e.target.checked)}
                />
              </div>
            </div>

            {!hasCashFlowData ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No payment data available</p>
                  <p className="text-sm">Add payments to see revenue trends</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={revenueSeries}
                    margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="month"
                      stroke="var(--border)"
                      tickLine={{ stroke: "var(--border)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
                      }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={50}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="var(--border)"
                      tickLine={{ stroke: "var(--border)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
                      }}
                      tickFormatter={(value) =>
                        formatWholeCurrency(Number(value ?? 0))
                      }
                    />
                    <YAxis yAxisId="right" hide />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value ?? 0), activeCurrency),
                        name,
                      ]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                      cursor={{
                        stroke: "var(--border)",
                        strokeDasharray: "3 3",
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      wrapperStyle={{ color: "var(--muted-foreground)" }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey={
                        revenueMode === "monthly"
                          ? "revenue"
                          : "revenueCumulative"
                      }
                      name={
                        revenueMode === "monthly"
                          ? "Revenue"
                          : "Cumulative Revenue"
                      }
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    {showMovingAverage && revenueMode === "monthly" && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenueMA"
                        name="Moving Average"
                        stroke="#1f9d5a"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="6 4"
                      />
                    )}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Expense Breakdown */}
        <div>
          <Card className="border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-6">
              Expense Breakdown
            </h2>
            {expenseBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No expense data available</p>
                  <p className="text-sm">
                    Complete payments to see expense breakdown
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ name, percent, x, y }) => (
                        <text
                          x={x}
                          y={y}
                          fill="var(--foreground)"
                          fontSize={10}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {`${name}: ${Math.round((percent || 0) * 100)}%`}
                        </text>
                      )}
                      labelLine={{ stroke: "var(--border)" }}
                    >
                      {expenseBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value}%`, name]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ color: "var(--muted-foreground)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Tenant Distribution by Category */}
      <Card className="border border-border p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
          Property Category Distribution
        </h2>
        <PropertyCategoryDistributionRing
          categories={propertyCategoryDistribution}
        />
      </Card>

      {/* Maintenance Analytics */}
      <Card className="border border-border p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
          Maintenance Request Analytics
        </h2>
        <MaintenanceAnalyticsRing maintenanceByStatus={maintenanceByStatus} />
      </Card>

      {/* Maintenance Trends & Cost Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
            Maintenance Trends
          </h2>
          <MaintenanceTrendsLine maintenanceRequests={maintenanceRequests} />
        </Card>

        <Card className="border border-border p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
            Maintenance Cost by Property
          </h2>
          <MaintenanceCostBar
            maintenanceRequests={maintenanceRequests}
            properties={properties}
            activeCurrency={activeCurrency}
          />
        </Card>
      </div>

      {/* Tenant Payment Analytics */}
      <Card className="border border-border p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
          Tenant Payment Analytics
        </h2>
        <TenantAnalyticsBar payments={payments} tenants={tenants} />
      </Card>

      {/* Lease Expiry Timeline */}
      <Card className="border border-border p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-foreground mb-4 md:mb-6">
          Lease Expiry Timeline
        </h2>
        <LeaseExpiryTimeline tenants={tenants} properties={properties} />
      </Card>
    </div>
  );
}
