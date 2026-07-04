"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppData } from "@/lib/data-context";
import {
  deleteTransaction,
  updateTransaction,
} from "@/app/lib/transactions-client";
import {
  updateExpenseApi,
  deleteExpenseApi,
  getAllExpenses,
} from "@/lib/services/expenses";
import {
  deletePaymentApi,
  listPaymentsApi,
  PAYMENT_LIST_FIELDS,
} from "@/lib/services/payments";
import { formatCurrency } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import { useSettings } from "@/lib/settings-context";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import {
  Plus,
  Filter,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  MoreHorizontal,
  Printer,
  Loader,
  Trash,
  Trash2,
} from "lucide-react";
import {
  AdminSkeletonHeader,
  AdminTableSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";
import { CsvColumn, downloadCsvFile } from "@/lib/csv";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import AddExpenseForm from "@/components/forms/add-expense-form";
import RecordPaymentModal from "@/components/modals/record-payment-modal";

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState("rent-collection");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    | "all"
    | "complete"
    | "balance"
    | "pending"
    | "failed"
    | "refunded"
    | "recorded"
    | "confirmed"
  >("complete");
  const [rentCurrentPage, setRentCurrentPage] = useState(1);
  const [expenseCurrentPage, setExpenseCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(
    null,
  );
  const [softDeletedPaymentIds, setSoftDeletedPaymentIds] = useState<string[]>(
    [],
  );
  const pendingDeleteTimers = useRef<Map<string, number>>(new Map());

  const {
    tenants: allTenants,
    properties: allProperties,
    payments,
    expenses,
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
  const { token, user } = useAuth();

  const rentPaymentsQuery = useQuery({
    queryKey: [
      "financeRentPayments",
      token || "",
      filterStatus,
      searchQuery,
      rentCurrentPage,
      pageSize,
    ],
    queryFn: async () =>
      listPaymentsApi({
        token: token ?? undefined,
        fields: PAYMENT_LIST_FIELDS,
        page: rentCurrentPage,
        limit: pageSize,
        sort: "-paidOn",
        search: searchQuery || undefined,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const expensePageQuery = useQuery({
    queryKey: [
      "financeExpenses",
      token || "",
      searchQuery,
      expenseCurrentPage,
      pageSize,
    ],
    queryFn: async () =>
      getAllExpenses({
        token: token ?? undefined,
        page: expenseCurrentPage,
        limit: pageSize,
        sort: "-date",
        search: searchQuery || undefined,
      }),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const activeCurrency = useActiveCurrency();
  const { settings } = useSettings();
  const companyTitle =
    settings?.companyInfo?.name?.trim() || "Aurex Property Manager";
  const companyAddress = settings?.companyInfo?.address;
  const companyContact =
    settings?.companyInfo?.phone?.trim() || "Aurex Property Manager";
  const companyEmail =
    settings?.companyInfo?.email?.trim() || "Aurex Property Manager";
  const companyAddressStr = companyAddress
    ? `${companyAddress.street || ""}${companyAddress.city ? ", " + companyAddress.city : ""}${companyAddress.state ? ", " + companyAddress.state : ""}${companyAddress.country ? ", " + companyAddress.country : ""}`
    : "";

  const paymentsData =
    payments.length > 0 ? payments : (rentPaymentsQuery.data ?? []);

  const handleDownloadPaymentReceipt = async (payment: any) => {
    if (typeof window === "undefined") return;

    try {
      const module = await import("jspdf");
      const { jsPDF } = module;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 40;
      const lineHeight = 18;
      const receiptTop = 56;

      const tenantName =
        payment.tenantName ||
        payment.tenant?.name ||
        allTenants.find(
          (tenant: any) =>
            tenant.id === payment.tenantId || tenant._id === payment.tenantId,
        )?.name ||
        "Tenant";
      const propertyName =
        payment.propertyName ||
        payment.property?.name ||
        allProperties.find(
          (property: any) =>
            property.id === payment.propertyId ||
            property._id === payment.propertyId,
        )?.name ||
        "Property";
      const receiptNumber = payment.transId || payment.id || "N/A";
      const paidDate =
        payment.paidOn || payment.paymentDate || payment.date || new Date();
      const amount = formatCurrency(payment.amount || 0, activeCurrency);
      const balance = formatCurrency(payment.balance || 0, activeCurrency);
      const status = String(payment.status || "Pending");
      const method = String(payment.method || "—");
      const note = String(
        payment.note || payment.notes || payment.description || "—",
      );
      const bank = String(payment.bank || payment.bankName || "—");
      const chequeNumber = String(
        payment.chequeNumber || payment.chequeNo || "",
      );
      const paidBy = payment.paidBy || payment.payer || tenantName;
      const amountWords = `${amount}`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(companyTitle, margin, receiptTop);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (companyAddressStr) {
        doc.text(companyAddressStr, margin, receiptTop + 24);
      }

      doc.text(companyEmail, margin, receiptTop + 56);
      doc.text(companyContact, margin, receiptTop + 40);
      doc.text("Receipt for rent payment", margin, receiptTop + 72);

      const rightColumnX = 420;
      doc.setFontSize(10);
      doc.text("Receipt No.", rightColumnX, receiptTop);
      doc.setFont("helvetica", "bold");
      doc.text(receiptNumber, rightColumnX, receiptTop + 16);
      doc.setFont("helvetica", "normal");
      doc.text("Date", rightColumnX, receiptTop + 36);
      doc.text(
        new Date(paidDate).toLocaleDateString(),
        rightColumnX,
        receiptTop + 52,
      );

      const sectionTop = receiptTop + 80;
      doc.setLineWidth(0.5);
      doc.line(margin, sectionTop, 555, sectionTop);

      let y = sectionTop + 24;
      doc.setFontSize(11);
      doc.text("Received from:", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(paidBy === user ? "Administration" : paidBy, margin + 110, y);

      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text("The sum of:", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(amountWords, margin + 110, y);

      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text("Payment Method:", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(method === "manual" ? "Cash" : method, margin + 110, y);

      // y += lineHeight;
      // doc.setFont("helvetica", "normal");
      // doc.text("Bank:", margin, y);
      // doc.setFont("helvetica", "bold");
      // doc.text(bank, margin + 110, y);

      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text("Balance:", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(balance, margin + 110, y);

      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text("Property:", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(propertyName, margin + 110, y);

      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text("Notes:", margin, y);
      doc.setFont("helvetica", "bold");
      const wrappedNote = doc.splitTextToSize(note, 360);
      doc.text(wrappedNote, margin + 110, y);
      y += wrappedNote.length * lineHeight;

      y += 16;
      doc.setDrawColor(200);
      doc.line(margin, y, 300, y);
      y += 14;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("With Thanks,", margin, y);
      doc.text("Signature", rightColumnX, y);

      const safeName = `${companyTitle}-${receiptNumber}`
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/\s+/g, "-");
      doc.save(`${safeName || "payment"}-receipt.pdf`);
      toast.success("Receipt PDF downloaded");
    } catch (error) {
      console.error("Receipt PDF generation failed", error);
      toast.error("Unable to generate receipt PDF");
    }
  };

  const expensesData =
    expenses.length > 0 ? expenses : (expensePageQuery.data ?? []);

  useEffect(() => {
    setRentCurrentPage(1);
  }, [searchQuery, filterStatus, pageSize]);

  useEffect(() => {
    setExpenseCurrentPage(1);
  }, [searchQuery, pageSize]);

  useEffect(() => {
    const refreshHandler = () => {
      refetchAll();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("transactionsUpdated", refreshHandler);
      window.addEventListener("paymentsUpdated", refreshHandler);
      window.addEventListener("expensesUpdated", refreshHandler);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("transactionsUpdated", refreshHandler);
        window.removeEventListener("paymentsUpdated", refreshHandler);
        window.removeEventListener("expensesUpdated", refreshHandler);
      }
      pendingDeleteTimers.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      pendingDeleteTimers.current.clear();
    };
  }, [refetchAll]);

  // Enrich transactions with tenant and property data from real lists
  const enrichedTransactions = (expensesData || []).map((transaction) => {
    const tenant = allTenants.find((t) => t.id === transaction.tenantId);
    const property = allProperties.find((p) => p.id === transaction.propertyId);
    return {
      ...transaction,
      tenantName: tenant?.name || "Unknown Tenant",
      propertyName: property?.name || "Unknown Property",
    };
  });

  const enrichPaymentRecord = (payment: any) => {
    const normalizeRecordId = (value: any) => {
      if (!value) return null;
      if (typeof value === "object") {
        return String(value._id || value.id || value.value || "");
      }
      return String(value);
    };

    const tenantId = normalizeRecordId(
      payment?.tenantId ?? payment?.tenant?.id ?? payment?.tenant?._id,
    );
    const propertyId = normalizeRecordId(
      payment?.propertyId ?? payment?.property?.id ?? payment?.property?._id,
    );

    const tenant = tenantId
      ? allTenants.find(
          (item) => String((item as any)._id || item.id) === tenantId,
        )
      : null;
    const property = propertyId
      ? allProperties.find(
          (item) => String((item as any)._id || item.id) === propertyId,
        )
      : null;

    const originalTxdId =
      payment?.txdId ??
      payment?.transId ??
      payment?.transactionId ??
      payment?.reference ??
      payment?.receiptReference ??
      payment?.id ??
      null;
    const originalNotes =
      payment?.notes ??
      payment?.note ??
      payment?.description ??
      payment?.reference ??
      payment?.receiptReference ??
      null;

    return {
      ...payment,
      tenantName:
        payment?.tenantName ||
        payment?.tenant?.name ||
        payment?.tenantDetails?.name ||
        tenant?.name ||
        "Unknown Tenant",
      propertyName:
        payment?.propertyName ||
        payment?.property?.name ||
        payment?.propertyDetails?.name ||
        property?.name ||
        "Unknown Property",
      paidBy: payment?.paidBy || payment?.recordedBy || payment?.payer || null,
      reasonForPayment:
        payment?.reasonForPayment ?? payment?.reason ?? originalNotes ?? null,
      notes: originalNotes,
      txdId: originalTxdId,
      transId: payment?.transId ?? originalTxdId,
    };
  };

  // Calculate financial metrics from persisted payments
  const enrichedPayments = useMemo(() => {
    return (paymentsData || [])
      .filter((payment) => !softDeletedPaymentIds.includes(payment.id))
      .map((p) => enrichPaymentRecord(p));
  }, [paymentsData, allTenants, allProperties, softDeletedPaymentIds]);

  const rentPayments = enrichedPayments;
  const tenantOutstandingBalances = useMemo(
    () =>
      allTenants
        .map((tenant) => Number(tenant.currentBalance ?? 0))
        .filter((balance) => balance > 0),
    [allTenants],
  );
  const expectedOutstanding = tenantOutstandingBalances.reduce(
    (sum, balance) => sum + balance,
    0,
  );
  const completedPayments = rentPayments.filter(
    (t) =>
      t.status === "complete" ||
      t.status === "completed" ||
      t.status === "paid",
  );
  const pendingPayments = rentPayments.filter((t) => {
    const status = String(t.status || "").toLowerCase();
    if (!["pending", "balance", ""].includes(status)) return false;
    if (!t.tenantId) return false;
    const tenant = allTenants.find((tenant) => tenant.id === t.tenantId);
    return Number(tenant?.currentBalance ?? 0) > 0;
  });

  const partialPayments = rentPayments.filter((t) => {
    const status = String(t.status || "").toLowerCase();
    if (status !== "balance") return false;
    const tenant = allTenants.find((tenant) => tenant.id === t.tenantId);
    return Number(tenant?.currentBalance ?? 0) > 0;
  });

  const totalRevenue = rentPayments
    .filter((t) => {
      const status = String(t.status || "").toLowerCase();
      return [
        "complete",
        "completed",
        "paid",
        "balance",
        "recorded",
        "confirmed",
        "settled",
        "success",
      ].includes(status);
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPending = tenantOutstandingBalances.reduce(
    (sum, balance) => sum + balance,
    0,
  );
  const totalExpenses = enrichedTransactions.reduce(
    (sum, t) => sum + (t.amount || 0),
    0,
  );
  const netProfit = totalRevenue - totalExpenses;
  const netLabel = netProfit >= 0 ? "Net Profit" : "Net Loss";
  const netColorClass = netProfit >= 0 ? "text-green-600" : "text-red-600";

  const chartData = useMemo(() => {
    const months = 6;
    const now = new Date();
    const monthKeys = Array.from({ length: months }).map((_, index) => {
      const d = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - (months - 1 - index),
          1,
        ),
      );
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      return { key, label };
    });

    const map: Record<string, { revenue: number; expenses: number }> = {};
    monthKeys.forEach(({ key }) => {
      map[key] = { revenue: 0, expenses: 0 };
    });

    const normalizeAmount = (value: any) => {
      const raw = value ?? 0;
      return Number(String(raw).replace(/[^0-9.-]+/g, "")) || 0;
    };

    const paymentMonth = (payment: any) => {
      const paymentData = payment as any;
      const dateString =
        paymentData.date ||
        paymentData.paymentDate ||
        paymentData.paidOn ||
        paymentData.createdAt;
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return null;
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 7);
    };

    const expenseMonth = (expense: any) => {
      const expenseData = expense as any;
      const dateString =
        expenseData.date ||
        expenseData.createdAt ||
        expenseData.transactionDate ||
        expenseData.postedAt ||
        expenseData.entryDate;
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return null;
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 7);
    };

    paymentsData.forEach((payment) => {
      const monthKey = paymentMonth(payment);
      if (!monthKey || !map[monthKey]) return;
      const status = String(payment.status || "").toLowerCase();
      const amount = normalizeAmount(
        payment.amount ??
          (payment as any).total ??
          (payment as any).value ??
          (payment as any).paymentAmount ??
          (payment as any).amountPaid,
      );
      const completeStatuses = [
        "complete",
        "completed",
        "paid",
        "balance",
        "recorded",
        "confirmed",
        "settled",
        "success",
      ];
      if (completeStatuses.includes(status) || status === "") {
        map[monthKey].revenue += amount;
      }
    });

    expensesData.forEach((expense) => {
      const monthKey = expenseMonth(expense);
      if (!monthKey || !map[monthKey]) return;
      const amount = normalizeAmount(
        expense.amount ??
          (expense as any).total ??
          (expense as any).value ??
          (expense as any).paymentAmount ??
          (expense as any).expenseAmount,
      );
      map[monthKey].expenses += amount;
    });

    return monthKeys.map(({ key, label }) => ({
      month: label,
      revenue: Math.round(map[key].revenue),
      expenses: Math.round(map[key].expenses),
    }));
  }, [paymentsData, expensesData]);

  const expenseBreakdown = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    expensesData.forEach((expense) => {
      const category = (expense.category || "Other").toString();
      categoryMap[category] =
        (categoryMap[category] || 0) + Number(expense.amount || 0);
    });

    const colorMap: Record<string, string> = {
      maintenance: "#8884d8",
      utilities: "#82ca9d",
      insurance: "#ffc658",
      rent: "#ff7c7c",
      repairs: "#a4de6c",
      cleaning: "#d084d0",
      management: "#ffc069",
    };

    return Object.entries(categoryMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
      value: Math.round(value),
      color: colorMap[name.toLowerCase()] || "#8884d8",
    }));
  }, [expenses]);

  const occupiedPropertyIds = new Set(
    allTenants.filter((t) => t.propertyId).map((t) => t.propertyId),
  );
  const occupancyRate = allProperties.length
    ? Math.round((occupiedPropertyIds.size / allProperties.length) * 1000) / 10
    : 0;

  // Filter payments by status
  const filteredPayments = rentPayments.filter((payment) => {
    const normalizedStatus = String(payment.status || "").toLowerCase();
    const matchesStatus =
      filterStatus === "complete" &&
      [
        "complete",
        "balance",
        "pending",
        "failed",
        "refunded",
        "recorded",
        "confirmed",
      ].includes(normalizedStatus);
    const matchesSearch =
      !searchQuery ||
      (payment.tenantName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (payment.propertyName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const expenseTransactions = enrichedTransactions
    .filter((t) => t.type === "expense")
    .filter(
      (expense) =>
        !searchQuery ||
        (expense.description || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );

  const totalRentPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / pageSize),
  );
  const paginatedPayments = filteredPayments.slice(
    (rentCurrentPage - 1) * pageSize,
    rentCurrentPage * pageSize,
  );

  const totalExpensePages = Math.max(
    1,
    Math.ceil(expenseTransactions.length / pageSize),
  );
  const paginatedExpenseTransactions = expenseTransactions.slice(
    (expenseCurrentPage - 1) * pageSize,
    expenseCurrentPage * pageSize,
  );

  const isServerRentPagination = rentPaymentsQuery.data !== undefined;
  const isServerExpensePagination = expensePageQuery.data !== undefined;

  const rentPaymentsDisplay = useMemo(() => {
    const source = isServerRentPagination
      ? (rentPaymentsQuery.data ?? [])
      : paginatedPayments;
    return source
      .filter((payment: any) => !softDeletedPaymentIds.includes(payment.id))
      .map((payment: any) => enrichPaymentRecord(payment));
  }, [
    isServerRentPagination,
    rentPaymentsQuery.data,
    paginatedPayments,
    softDeletedPaymentIds,
  ]);
  const expenseTransactionsDisplay = isServerExpensePagination
    ? expensePageQuery.data
    : paginatedExpenseTransactions;

  const rentHasNextPage = isServerRentPagination
    ? (rentPaymentsDisplay?.length ?? 0) === pageSize
    : rentCurrentPage < totalRentPages;
  const expenseHasNextPage = isServerExpensePagination
    ? (expenseTransactionsDisplay?.length ?? 0) === pageSize
    : expenseCurrentPage < totalExpensePages;

  const handleRowClick = (tx: any) => {
    const payment = enrichPaymentRecord(tx);
    setSelectedTx(payment);
    setIsEditingTx(false);
    setTxFormData({
      ...payment,
      amount: payment.amount.toString(),
    });
    setIsTxDialogOpen(true);
  };

  const handlePrintPaymentReceipt = (payment: any) => {
    if (!payment) return;
    if (typeof window === "undefined") return;

    const receiptPayment = enrichPaymentRecord(payment);
    const receiptDate =
      receiptPayment.paidOn ||
      receiptPayment.paymentDate ||
      receiptPayment.date;
    const receiptBalance = Number(
      receiptPayment.balanceAfterPayment ?? receiptPayment.balance ?? 0,
    );
    const companyName =
      settings?.companyInfo?.name?.trim() || "Aurex Property Manager";
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payment Receipt ${receiptPayment.transId || receiptPayment.id}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
            .container { max-width: 720px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 12px; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; }
            .title { font-size: 24px; font-weight: 700; margin: 0; }
            .sub { color: #6b7280; margin-top: 4px; }
            .summary { margin-top: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
            .amount { font-size: 28px; font-weight: 700; margin-top: 6px; }
            .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
            .detail { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
            .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
            .value { margin-top: 4px; font-weight: 600; }
            .footer { margin-top: 20px; color: #6b7280; font-size: 13px; }
            @media print { body { margin: 0; } .container { border: none; box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div>
                <h1 class="title">${companyName}</h1>
                <p class="sub">Receipt for rent payment</p>
              </div>
              <div style="text-align: right;">
                <div class="label">Receipt No.</div>
                <div class="value">${receiptPayment.transId || receiptPayment.id}</div>
                <div class="sub">${receiptDate ? new Date(receiptDate).toLocaleString() : "—"}</div>
              </div>
            </div>
            <div class="summary">
              <div class="label">Amount Paid</div>
              <div class="amount">${formatCurrency(receiptPayment.amount || 0, activeCurrency)}</div>
              <div class="sub">Status: ${String(receiptPayment.status || "complete").toUpperCase()}</div>
            </div>
            <div class="details">
              <div class="detail"><div class="label">Tenant</div><div class="value">${receiptPayment.tenantName || "—"}</div></div>
              <div class="detail"><div class="label">Property</div><div class="value">${receiptPayment.propertyName || "—"}</div></div>
              <div class="detail"><div class="label">Payer</div><div class="value">${receiptPayment.paidBy || "—"}</div></div>
              <div class="detail"><div class="label">Balance</div><div class="value">${formatCurrency(receiptBalance, activeCurrency)}</div></div>
              <div class="detail"><div class="label">Date</div><div class="value">${receiptDate ? new Date(receiptDate).toLocaleDateString() : "—"}</div></div>
              <div class="detail"><div class="label">Payment Method</div><div class="value">${receiptPayment.paymentMethod || "—"}</div></div>
            </div>
            <div class="detail" style="margin-top: 16px;"><div class="label">Reason for payment</div><div class="value">${receiptPayment.reasonForPayment || "—"}</div></div>
            <div class="footer">Thank you for your payment. Please keep this receipt for your records.</div>
          </div>
        </body>
      </html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const handleDeletePayment = async (payment: any) => {
    if (!payment?.id) return;

    const paymentId = payment.id;
    setDeletingPaymentId(paymentId);
    setSoftDeletedPaymentIds((prev) =>
      prev.includes(paymentId) ? prev : [...prev, paymentId],
    );

    const timer = window.setTimeout(async () => {
      pendingDeleteTimers.current.delete(paymentId);
      try {
        const deleted = await deletePaymentApi(paymentId);
        if (deleted) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("paymentsUpdated"));
          }
          toast.success("Payment deleted", {
            description: "The payment record was removed permanently.",
          });
        } else {
          setSoftDeletedPaymentIds((prev) =>
            prev.filter((id) => id !== paymentId),
          );
          toast.error("Unable to delete payment", {
            description: "The payment could not be deleted right now.",
          });
        }
      } catch (error) {
        console.error("Failed to delete payment", error);
        setSoftDeletedPaymentIds((prev) =>
          prev.filter((id) => id !== paymentId),
        );
        toast.error("Unable to delete payment", {
          description: "The payment could not be deleted right now.",
        });
      } finally {
        setDeletingPaymentId(null);
      }
    }, 6000);

    pendingDeleteTimers.current.set(paymentId, timer);

    toast.success("Payment deleted", {
      description: "The payment was removed from the list. Undo to restore it.",
      action: {
        label: "Undo",
        onClick: () => {
          const existingTimer = pendingDeleteTimers.current.get(paymentId);
          if (existingTimer) {
            window.clearTimeout(existingTimer);
            pendingDeleteTimers.current.delete(paymentId);
          }
          setSoftDeletedPaymentIds((prev) =>
            prev.filter((id) => id !== paymentId),
          );
          setDeletingPaymentId(null);
          toast.success("Payment restored", {
            description: "The payment is back on the list.",
          });
        },
      },
      duration: 6000,
    });
  };

  const refreshTransactions = () => {
    refetchAll();
  };
  const refreshPayments = () => {
    refetchAll();
  };

  const isPageLoading = isInitialDataLoading;
  const showPaymentsCardSkeleton = isPaymentsInitialLoading && !isPageLoading;
  const showExpensesCardSkeleton = isExpensesInitialLoading && !isPageLoading;
  const showFinancialCardSkeleton =
    (isPaymentsInitialLoading || isExpensesInitialLoading) && !isPageLoading;

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  const paymentCsvColumns: CsvColumn<any>[] = [
    { label: "Payment ID", value: (item) => item.id },
    {
      label: "Transaction ID",
      value: (item) => item.transId || item.transactionId || "",
    },
    { label: "Tenant", value: (item) => item.tenantName },
    { label: "Property", value: (item) => item.propertyName },
    { label: "Amount", value: (item) => item.amount },
    { label: "Currency", value: (item) => item.currency || activeCurrency },
    { label: "Status", value: (item) => item.status },
    {
      label: "Payment Method",
      value: (item) => item.paymentMethod || item.method,
    },
    {
      label: "Reference",
      value: (item) => item.reference || item.paymentReference || "",
    },
    {
      label: "Date",
      value: (item) =>
        item.date || item.paymentDate || item.paidOn || item.createdAt,
    },
    { label: "Notes", value: (item) => item.notes || item.description || "" },
  ];

  const expenseCsvColumns: CsvColumn<any>[] = [
    { label: "Expense ID", value: (item) => item.id },
    {
      label: "Transaction ID",
      value: (item) => item.transId || item.transactionId || "",
    },
    { label: "Property", value: (item) => item.propertyName },
    { label: "Unit", value: (item) => item.unit || "" },
    { label: "Category", value: (item) => item.category },
    { label: "Amount", value: (item) => item.amount },
    { label: "Currency", value: (item) => item.currency || activeCurrency },
    { label: "Status", value: (item) => item.status },
    {
      label: "Payment Method",
      value: (item) => item.paymentMethod || item.method || "",
    },
    { label: "Description", value: (item) => item.description || "" },
    {
      label: "Date",
      value: (item) =>
        item.date ||
        item.createdAt ||
        item.transactionDate ||
        item.postedAt ||
        item.entryDate,
    },
  ];

  const handleExportPaymentsCsv = () => {
    downloadCsvFile("payments.csv", paymentCsvColumns, enrichedPayments);
  };

  const handleExportExpensesCsv = () => {
    downloadCsvFile("expenses.csv", expenseCsvColumns, expenseTransactions);
  };

  // dialog for viewing/editing a transaction
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [isEditingTx, setIsEditingTx] = useState(false);
  const [txFormData, setTxFormData] = useState<any>({});

  if (isPageLoading) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border border-border p-4 sm:p-6">
              <Skeleton className="h-5 w-1/3 mb-4 rounded-full" />
              <Skeleton className="h-10 w-2/3 rounded-xl" />
              <Skeleton className="h-4 w-1/2 rounded-xl mt-4" />
            </Card>
          ))}
        </div>

        <Card className="border border-border p-6">
          <Skeleton className="h-6 w-1/3 rounded-xl mb-4" />
          <Skeleton className="h-72 rounded-3xl" />
        </Card>

        <Card className="border border-border p-6">
          <Skeleton className="h-6 w-1/3 rounded-xl mb-4" />
          <AdminTableSkeleton rowCount={5} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground mb-1">Finances</h1>
          <p className="text-muted-foreground">
            Manage rent collection, expenses, and financial reports
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">
            Total Revenue
          </p>
          <p className="text-2xl sm:text-lg font-bold text-green-600 dark:text-green-400 mb-1 whitespace-nowrap truncate">
            {showPaymentsCardSkeleton ? (
              <span className="inline-block">
                <Skeleton className="h-10 w-32 rounded-xl" />
              </span>
            ) : (
              formatCurrency(totalRevenue, activeCurrency)
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Includes partial and completed rent payments
          </p>
        </Card>

        <Card className="border border-border p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">
            Outstanding Balances
          </p>
          <p className="text-2xl sm:text-lg font-bold text-orange-600 dark:text-orange-400 mb-1 whitespace-nowrap truncate">
            {showPaymentsCardSkeleton ? (
              <span className="inline-block">
                <Skeleton className="h-10 w-32 rounded-xl" />
              </span>
            ) : (
              formatCurrency(expectedOutstanding, activeCurrency)
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Expected from partial payments and overdue rent
          </p>
        </Card>

        <Card className="border border-border p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">
            Pending Payments
          </p>
          <p className="text-2xl sm:text-lg font-bold text-orange-600 dark:text-orange-400 mb-1 whitespace-nowrap truncate">
            {showPaymentsCardSkeleton ? (
              <span className="inline-block">
                <Skeleton className="h-10 w-24 rounded-xl" />
              </span>
            ) : (
              formatCurrency(totalPending, activeCurrency)
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {showPaymentsCardSkeleton ? (
              <span className="inline-block">
                <Skeleton className="h-4 w-24 rounded-xl" />
              </span>
            ) : (
              `${pendingPayments.length} pending/partial payments`
            )}
          </p>
        </Card>

        <Card className="border border-border p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">
            Total Expenses
          </p>
          <p className="text-2xl sm:text-lg font-bold text-foreground mb-1 whitespace-nowrap truncate">
            {showExpensesCardSkeleton ? (
              <span className="inline-block">
                <Skeleton className="h-10 w-32 rounded-xl" />
              </span>
            ) : (
              formatCurrency(totalExpenses, activeCurrency)
            )}
          </p>
          <p className="text-xs text-muted-foreground">Maintenance & other</p>
        </Card>

        <Card className="border border-border p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">
            {netLabel}
          </p>
          <p
            className={`text-2xl sm:text-lg font-bold mb-1 ${netColorClass} whitespace-nowrap truncate`}
          >
            {showFinancialCardSkeleton ? (
              <span className="inline-block">
                <Skeleton className="h-10 w-32 rounded-xl" />
              </span>
            ) : (
              formatCurrency(netProfit, activeCurrency)
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Revenue minus expenses
          </p>
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

      {/* Tabs */}

      {/* transaction detail dialog */}
      <RecordPaymentModal
        open={showRecordPayment}
        onOpenChange={setShowRecordPayment}
      />
      <Dialog open={isTxDialogOpen} onOpenChange={setIsTxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditingTx ? "Edit Transaction" : "Transaction Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedTx ? selectedTx.id : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedTx &&
            !isEditingTx &&
            (selectedTx.type === "expense" ? (
              <div className="space-y-2">
                {selectedTx.transID && (
                  <p>
                    <strong>Trans ID:</strong> {selectedTx.transID}
                  </p>
                )}
                <p>
                  <strong>Type:</strong> {selectedTx.type}
                </p>
                <p>
                  <strong>Amount:</strong>{" "}
                  {formatCurrency(selectedTx.amount, activeCurrency)}
                </p>
                <p>
                  <strong>Status:</strong> {selectedTx.status}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(selectedTx.date).toLocaleString()}
                </p>
                <p>
                  <strong>Property:</strong> {selectedTx.propertyName || "N/A"}
                </p>
                <p>
                  <strong>Tenant:</strong> {selectedTx.tenantName || "N/A"}
                </p>
                <p>
                  <strong>Description:</strong> {selectedTx.notes || "—"}
                </p>
                {selectedTx.receiptReference && (
                  <p>
                    <strong>Receipt/Invoice Reference:</strong>{" "}
                    {selectedTx.receiptReference}
                  </p>
                )}
                {selectedTx.category && (
                  <p>
                    <strong>Category:</strong> {selectedTx.category}
                  </p>
                )}
                {selectedTx.paymentMethod && (
                  <p>
                    <strong>Payment Method:</strong> {selectedTx.paymentMethod}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Receipt
                    </p>
                    <h3 className="text-xl font-semibold text-foreground">
                      Aurex Property Manager
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Rent payment confirmation
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Receipt No.
                    </p>
                    <p className="font-semibold text-foreground">
                      {selectedTx.txdId || selectedTx.id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTx.paidOn ||
                      selectedTx.paymentDate ||
                      selectedTx.date
                        ? new Date(
                            selectedTx.paidOn ||
                              selectedTx.paymentDate ||
                              selectedTx.date,
                          ).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-xl border border-border bg-background/80 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Amount Paid
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {formatCurrency(selectedTx.amount, activeCurrency)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-sm font-medium text-emerald-600">
                        {String(selectedTx.status || "complete").toUpperCase()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Paid via {selectedTx.paymentMethod || "manual"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/80 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Balance
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatCurrency(
                        Number(
                          selectedTx.balanceAfterPayment ??
                            selectedTx.balance ??
                            0,
                        ),
                        activeCurrency,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Previous balance:{" "}
                      {formatCurrency(
                        Number(selectedTx.priorBalance ?? 0),
                        activeCurrency,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Tenant
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {selectedTx.tenantName || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Property
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {selectedTx.propertyName || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Payer
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {selectedTx.paidBy || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Date
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {selectedTx.paidOn ||
                      selectedTx.paymentDate ||
                      selectedTx.date
                        ? new Date(
                            selectedTx.paidOn ||
                              selectedTx.paymentDate ||
                              selectedTx.date,
                          ).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-border/70 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Reason for payment
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedTx.reasonForPayment || selectedTx.notes || "—"}
                  </p>
                </div>
                <div className="mt-5 rounded-lg border border-border/70 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Notes / Description
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedTx.notes || "—"}
                  </p>
                </div>
              </div>
            ))}

          {selectedTx && isEditingTx && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const basePatch = {
                  amount: Number(txFormData.amount),
                  status: txFormData.status,
                  date: txFormData.date,
                  description: txFormData.description,
                  propertyId: txFormData.propertyId,
                  tenantId: txFormData.tenantId,
                  category: txFormData.category,
                  paymentMethod: txFormData.paymentMethod,
                };
                try {
                  if (selectedTx.type === "expense") {
                    await updateExpenseApi(selectedTx.id, basePatch);
                  } else {
                    updateTransaction(selectedTx.id, {
                      ...basePatch,
                      type: txFormData.type,
                    });
                  }
                } catch (err) {
                  console.error("Failed to update transaction", err);
                }
                await refreshTransactions();
                setIsTxDialogOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Type
                </label>
                <select
                  value={txFormData.type}
                  onChange={(e) =>
                    setTxFormData({ ...txFormData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="rent">Rent</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              {txFormData.type === "expense" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Category
                  </label>
                  <Input
                    type="text"
                    value={txFormData.category || ""}
                    onChange={(e) =>
                      setTxFormData({ ...txFormData, category: e.target.value })
                    }
                    placeholder="e.g., maintenance, utilities, repairs"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Payment Method
                </label>
                <select
                  value={txFormData.paymentMethod || ""}
                  onChange={(e) =>
                    setTxFormData({
                      ...txFormData,
                      paymentMethod: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="">Select Method</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Amount
                </label>
                <Input
                  type="text"
                  value={txFormData.amount}
                  onChange={(e) =>
                    setTxFormData({ ...txFormData, amount: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Status
                </label>
                <select
                  value={txFormData.status}
                  onChange={(e) =>
                    setTxFormData({ ...txFormData, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date
                </label>
                <Input
                  type="datetime-local"
                  value={txFormData.date}
                  onChange={(e) =>
                    setTxFormData({ ...txFormData, date: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <Textarea
                  value={txFormData.description}
                  onChange={(e) =>
                    setTxFormData({
                      ...txFormData,
                      description: e.target.value,
                    })
                  }
                  className="h-20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingTx(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Save
                </Button>
              </div>
            </form>
          )}

          <DialogFooter>
            {!isEditingTx && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTxDialogOpen(false)}
                >
                  Close
                </Button>
                {selectedTx && selectedTx.type !== "expense" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePrintPaymentReceipt(selectedTx)}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                  </Button>
                )}
                <Button onClick={() => setIsEditingTx(true)}>Edit</Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="border-b border-border bg-transparent h-auto p-0 rounded-none">
            <TabsTrigger
              value="rent-collection"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
            >
              Rent Collection
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
            >
              Expenses
            </TabsTrigger>
            {/* <TabsTrigger
              value="reports"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              Reports
            </TabsTrigger> */}
          </TabsList>

          {/* <Button size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button> */}
        </div>

        {/* Rent Collection Tab */}
        <TabsContent value="rent-collection" className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Input
                placeholder="Filter by tenant or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="completed">Paid</option>
              <option value="pending">Pending</option>
            </select>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportPaymentsCsv()}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Payments
              </Button>
              <Button
                size="sm"
                onClick={() => setShowRecordPayment(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {rentPaymentsDisplay.length > 0 ? (
              rentPaymentsDisplay.map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  <div
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => handleRowClick(payment)}
                  >
                    <div>
                      {payment.status === "complete" ||
                      payment.status === "completed" ||
                      payment.status === "paid" ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {payment.tenantName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.propertyName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <b>Reason:</b> {payment.reasonForPayment}
                      </p>
                      {payment.reasonForPayment === "balancePayment" && (
                        <p className="text-sm text-muted-foreground">
                          <b>Balance:</b>{" "}
                          {payment.priorBalance != null
                            ? formatCurrency(
                                payment.priorBalance,
                                activeCurrency,
                              )
                            : "—"}{" "}
                          →{" "}
                          {payment.balanceAfterPayment != null
                            ? formatCurrency(
                                payment.balanceAfterPayment,
                                activeCurrency,
                              )
                            : "—"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-foreground">
                      {formatCurrency(payment.amount, activeCurrency)}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        ["complete", "completed", "paid"].includes(
                          String(payment.status || "").toLowerCase(),
                        )
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {["complete", "completed", "paid"].includes(
                        String(payment.status || "").toLowerCase(),
                      )
                        ? "Paid"
                        : String(payment.status || "").toLowerCase() ===
                            "balance"
                          ? "Partial payment"
                          : "Pending"}{" "}
                      {payment.balance && payment.balance > 0
                        ? `• ${formatCurrency(payment.balance, activeCurrency)}`
                        : ""}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 ml-4"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          handleRowClick(payment);
                          console.log(
                            "View details clicked for payment:",
                            payment,
                          );
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={deletingPaymentId === payment.id}
                        onClick={() => handleDeletePayment(payment)}
                        className="text-destructive hover:bg-red-300"
                      >
                        {deletingPaymentId === payment.id ? (
                          <>
                            Deleting...{" "}
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          </>
                        ) : (
                          <>
                            {" "}
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </>
                        )}
                      </DropdownMenuItem>
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
                        onClick={() => handleDownloadPaymentReceipt(payment)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download receipt PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            ) : (
              <div className="text-center py-8 border border-border rounded-lg bg-secondary/30">
                <p className="text-muted-foreground">No rent payments found</p>
              </div>
            )}

            {rentPaymentsDisplay.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm text-muted-foreground">
                <p>
                  Showing{" "}
                  {Math.min(
                    (rentCurrentPage - 1) * pageSize + 1,
                    rentPaymentsDisplay.length,
                  )}
                  -
                  {Math.min(
                    rentCurrentPage * pageSize,
                    rentPaymentsDisplay.length,
                  )}{" "}
                  {isServerRentPagination
                    ? "rent payments"
                    : `of ${filteredPayments.length} rent payments`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rentCurrentPage <= 1}
                    onClick={() =>
                      setRentCurrentPage((page) => Math.max(page - 1, 1))
                    }
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {rentCurrentPage}
                    {!isServerRentPagination && ` of ${totalRentPages}`}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!rentHasNextPage}
                    onClick={() => setRentCurrentPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                  <select
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {[6, 12, 24, 48].map((size) => (
                      <option key={size} value={size}>
                        {size} per page
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="p-6 space-y-4">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Input
                placeholder="Filter by description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportExpensesCsv()}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Expenses
            </Button>
            <Button size="sm" onClick={() => setShowAddExpense(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </div>

          <AddExpenseForm
            isOpen={showAddExpense}
            onClose={() => setShowAddExpense(false)}
            onSubmit={() => {
              setShowAddExpense(false);
              refreshTransactions();
            }}
          />

          <div>
            {expenseTransactionsDisplay.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {expenseTransactionsDisplay.map((expense: any) => (
                  <Card
                    key={expense.id}
                    className="p-4 border border-border hover:bg-secondary transition-colors cursor-pointer h-full"
                    onClick={() => handleRowClick(expense)}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-5">
                            {expense.category || "Expense"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {expense.propertyName}
                            {expense.unit ? ` • ${expense.unit}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">
                            -{formatCurrency(expense.amount, activeCurrency)}
                          </p>
                          <p
                            className={`text-xs font-semibold ${expense.status === "completed" ? "text-green-600" : expense.status === "pending" ? "text-orange-600" : "text-red-600"}`}
                          >
                            {expense.status.charAt(0).toUpperCase() +
                              expense.status.slice(1)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex-1">
                        <p className="text-sm text-foreground leading-5 line-clamp-3">
                          {expense.description}
                        </p>
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                        <div className="truncate">
                          {expense.transID && (
                            <span className="mr-2">ID: {expense.transID}</span>
                          )}
                          {expense.receiptReference && (
                            <span>Receipt: {expense.receiptReference}</span>
                          )}
                        </div>
                        <div className="text-right">
                          {expense.paymentMethod && (
                            <span className="inline-block bg-muted px-2 py-1 rounded-md text-[11px]">
                              {expense.paymentMethod}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-border rounded-lg bg-secondary/30">
                <p className="text-muted-foreground">No expenses found</p>
              </div>
            )}

            {expenseTransactionsDisplay.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm text-muted-foreground">
                <p>
                  Showing{" "}
                  {Math.min(
                    (expenseCurrentPage - 1) * pageSize + 1,
                    expenseTransactionsDisplay.length,
                  )}
                  -
                  {Math.min(
                    expenseCurrentPage * pageSize,
                    expenseTransactionsDisplay.length,
                  )}{" "}
                  {isServerExpensePagination
                    ? "expenses"
                    : `of ${expenseTransactions.length} expenses`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={expenseCurrentPage <= 1}
                    onClick={() =>
                      setExpenseCurrentPage((page) => Math.max(page - 1, 1))
                    }
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {expenseCurrentPage}
                    {!isServerExpensePagination && ` of ${totalExpensePages}`}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!expenseHasNextPage}
                    onClick={() => setExpenseCurrentPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                  <select
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {[6, 12, 24, 48].map((size) => (
                      <option key={size} value={size}>
                        {size} per page
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Reports Tab: merged from standalone reports page */}
        <TabsContent value="reports" className="p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <h1 className="text-2xl md:text-lg font-bold text-foreground">
                Reports & Analytics
              </h1>
              <p className="text-muted-foreground">
                Generate and download detailed reports for your properties
              </p>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Report Type
                </label>
                <select
                  value={undefined as any}
                  onChange={() => {}}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="income">Income Report</option>
                  <option value="expense">Expense Report</option>
                  <option value="tax">Tax Preparation</option>
                  <option value="occupancy">Occupancy Report</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Time Period
                </label>
                <select
                  defaultValue="month"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
              </div>
              <div className="flex gap-2 col-span-1 sm:col-span-2">
                <Button className="flex-1 bg-primary hover:bg-primary/90 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Apply</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-border bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </div>
            </div>

            {/* Report Type Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { id: "income", label: "Income Report", icon: "📊" },
                { id: "expense", label: "Expense Report", icon: "📉" },
                { id: "tax", label: "Tax Preparation", icon: "📋" },
                { id: "occupancy", label: "Occupancy Report", icon: "📈" },
              ].map((type) => (
                <Card key={type.id} className="p-4">
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <p className="text-sm font-medium text-foreground text-center">
                    {type.label}
                  </p>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-border p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">
                  Revenue Trends
                </h3>
                <div className="w-full h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={{ fill: "var(--primary)", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="border border-border p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">
                  Expense Breakdown
                </h3>
                <div className="w-full h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }: any) =>
                          `${name}: ${formatCurrency(Number(value), activeCurrency)}`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {expenseBreakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) =>
                          formatCurrency(Number(value), activeCurrency)
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Revenue",
                  value: formatCurrency(totalRevenue, activeCurrency),
                  change: undefined,
                },
                {
                  label: "Total Expenses",
                  value: formatCurrency(totalExpenses, activeCurrency),
                  change: undefined,
                },
                {
                  label: netLabel,
                  value: formatCurrency(netProfit, activeCurrency),
                  change: undefined,
                },
                {
                  label: "Occupancy Rate",
                  value: `${occupancyRate}%`,
                  change: undefined,
                },
              ].map((stat) => (
                <Card key={stat.label} className="border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  {stat.change ? (
                    <p className="text-xs text-primary mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {stat.change}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>

            {/* Recent Reports */}
            <Card className="border border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Recent Reports
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                        Report Name
                      </th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">
                        Period
                      </th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">
                        Generated
                      </th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        name: "Monthly Income Report",
                        period: "January 2024",
                        generated: "2024-02-01",
                      },
                      {
                        name: "Tax Preparation Report",
                        period: "Q4 2023",
                        generated: "2024-01-15",
                      },
                      {
                        name: "Occupancy Analysis",
                        period: "December 2023",
                        generated: "2024-01-05",
                      },
                      {
                        name: "Expense Summary",
                        period: "November 2023",
                        generated: "2023-12-20",
                      },
                    ].map((report, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-border hover:bg-secondary"
                      >
                        <td className="py-3 px-2 text-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="truncate">{report.name}</span>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">
                          {report.period}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">
                          {report.generated}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary/80"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
