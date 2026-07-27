"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Filter,
  MoreHorizontal,
  Printer,
  Share2,
  Lock,
  AlertCircle,
  CheckCircle,
  CreditCard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import { useFeatureEnabled } from "@/lib/hooks/use-tenant-portal-features";
import {
  createManualPayment,
  createPaystackPayment,
  PAYMENT_LIST_FIELDS,
  PaymentRecord,
  RentPayment,
  getPaymentsForTenant,
} from "@/lib/services/payments";
import { openPaystackPopup } from "@/lib/services/paystack-popup";
import { AdminPaymentMethod, PaymentMethodType } from "@/lib/services/settings";
import { useTenantContext } from "@/lib/tenant-context";

type PaymentRow = RentPayment | PaymentRecord;

export default function PaymentsPage() {
  const router = useRouter();
  const activeCurrency = useActiveCurrency();
  const { user, token } = useAuth();
  const { payments, currentTenant, currentProperty } = useTenantContext();
  const { settings: apiSettings } = useSettings();
  const { enabled: paymentEnabled, isLoaded: featuresLoaded } =
    useFeatureEnabled("paymentPortal");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Make Payment state
  const [step, setStep] = useState<
    "amount" | "method" | "details" | "confirm" | "success" | "history"
  >("amount");
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("");
  const [processing, setProcessing] = useState(false);
  const [savedPayment, setSavedPayment] = useState<RentPayment | null>(null);
  const [paystackVerificationState, setPaystackVerificationState] = useState<
    "idle" | "pending" | "confirmed" | "failed"
  >("idle");

  // Use tenant and property from context (already derived)
  const tenant = currentTenant;
  const property = currentProperty;

  const defaultRent =
    Number(tenant?.rentAmount ?? property?.price_per_unit ?? 0) +
    Number(property?.serviceFee ?? 0);

  const PAYMENT_METHOD_LABELS: Record<PaymentMethodType | string, string> = {
    MTN_MoMo: "MTN MoMo",
    Airtel_Money: "Airtel Money",
    Orange_Money: "Orange Money",
    Visa_Mastercard: "Credit / Debit Card",
    Bank_Transfer: "Bank Transfer",
    Paystack: "Paystack",
  };

  const MOBILE_MONEY_TYPES = new Set<PaymentMethodType>([
    "MTN_MoMo",
    "Airtel_Money",
    "Orange_Money",
  ]);

  const getPaymentMethodId = (method: AdminPaymentMethod) =>
    method._id || method.type;

  const getPaymentMethodLabel = (method: AdminPaymentMethod | null) =>
    method
      ? PAYMENT_METHOD_LABELS[method.type] || method.type.replace(/_/g, " ")
      : "Payment Method";

  const getPaymentMethodDescription = (method: AdminPaymentMethod | null) => {
    if (!method) return "";
    if (method.type === "Paystack") {
      return "Pay with any payment method supported by Paystack (cards, mobile money, bank transfer, etc.)";
    }
    if (method.type === "Bank_Transfer") {
      return method.bankDetails?.bankName
        ? `Use account ${method.bankDetails.accountNumber || "N/A"} at ${method.bankDetails.bankName}.`
        : "Transfer directly using the bank details provided by your landlord.";
    }
    if (method.type === "Visa_Mastercard") {
      return "Pay with Visa or Mastercard. Card checkout will be processed after confirmation.";
    }
    if (MOBILE_MONEY_TYPES.has(method.type as PaymentMethodType)) {
      return method.transactionNumber
        ? `Use mobile money account ${method.transactionNumber}.`
        : "Pay with your mobile money wallet.";
    }
    return "Proceed with the selected payment method.";
  };

  const configuredPaymentMethods = useMemo(
    () => (apiSettings?.finance?.paymentMethods || []) as AdminPaymentMethod[],
    [apiSettings?.finance?.paymentMethods],
  );

  const enabledPaymentMethods = useMemo(
    () => configuredPaymentMethods.filter((pm) => pm.enabled),
    [configuredPaymentMethods],
  );

  const paymentMethods = enabledPaymentMethods;

  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find((pm) => getPaymentMethodId(pm) === method) ||
      paymentMethods[0] ||
      null,
    [method, paymentMethods],
  );

  const hasPaymentMethods = paymentMethods.length > 0;

  const requiresPhoneNumber = false;

  useEffect(() => {
    if (!method && paymentMethods.length > 0) {
      const preferredMethod =
        paymentMethods.find((pm) => pm.type === "Paystack") ||
        paymentMethods[0];
      setMethod(getPaymentMethodId(preferredMethod));
    } else if (
      method &&
      paymentMethods.length > 0 &&
      !paymentMethods.some((pm) => getPaymentMethodId(pm) === method)
    ) {
      const preferredMethod =
        paymentMethods.find((pm) => pm.type === "Paystack") ||
        paymentMethods[0];
      setMethod(getPaymentMethodId(preferredMethod));
    }
  }, [method, paymentMethods]);

  useEffect(() => {
    const defaultAmount = defaultRent > 0 ? defaultRent : 0;
    setAmount(defaultAmount);
  }, [defaultRent]);

  useEffect(() => {
    if (!featuresLoaded) return;
    if (!paymentEnabled) {
      router.replace("/tenant/feature-disabled?feature=payments");
    }
  }, [featuresLoaded, paymentEnabled, router]);

  const tenantPayments = tenant
    ? payments.filter((p) => p.tenantId === tenant.id)
    : [];
  const tenantPaymentsQuery = useQuery({
    queryKey: [
      "tenantPayments",
      tenant?.id,
      currentPage,
      pageSize,
      token || "",
    ],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return await getPaymentsForTenant(tenant.id, {
        token: token ?? undefined,
        fields: PAYMENT_LIST_FIELDS,
        page: currentPage,
        limit: pageSize,
        sort: "-paidOn",
      });
    },
    enabled: Boolean(tenant?.id && token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  const tenantPaymentsData = tenantPaymentsQuery.data ?? tenantPayments;
  const isTenantPaymentsLoading =
    tenantPaymentsQuery.isLoading || tenantPaymentsQuery.isFetching;

  const totalPaid = tenantPayments
    .filter((p) => p.status === "complete")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pollPaystackPaymentStatus = async (
    reference: string,
    paymentId?: string,
  ) => {
    const maxAttempts = 12;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const paymentStatusResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/payments/${encodeURIComponent(paymentId || reference)}`,
          {
            headers: {
              Authorization: `Bearer ${token || ""}`,
            },
          },
        );

        if (paymentStatusResponse.ok) {
          const paymentData = await paymentStatusResponse.json();
          const latestPayment =
            paymentData?.data || paymentData?.payment || null;
          if (latestPayment?.status === "complete") {
            setSavedPayment(latestPayment as RentPayment);
            setPaystackVerificationState("confirmed");
            setStep("success");
            setProcessing(false);
            return;
          }

          if (latestPayment?.status === "failed") {
            setPaystackVerificationState("failed");
            setProcessing(false);
            setStep("confirm");
            return;
          }
        }
      } catch (error) {
        console.warn("Paystack verification polling failed:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    setPaystackVerificationState("pending");
    setStep("confirm");
    setProcessing(false);
  };

  const handlePaymentSubmit = async () => {
    if (step === "amount") {
      setStep("method");
      return;
    }

    if (step === "method") {
      if (!selectedPaymentMethod) {
        alert(
          "No payment methods are available. Please contact your property administrator.",
        );
        return;
      }
      setStep("confirm");
      return;
    }

    if (step === "details") {
      setStep("confirm");
      return;
    }

    if (step === "confirm") {
      setProcessing(true);
      try {
        const payload: Partial<RentPayment> & {
          phoneNumber?: string;
          method?: string;
          serviceFee?: number;
        } = {
          tenantId: tenant?.id || user?.id || "",
          propertyId: tenant?.propertyId || property?.id,
          amount,
          monthlyRent: tenant?.rentAmount ?? property?.price_per_unit,
          serviceFee: property?.serviceFee ?? 0,
          paymentDate: new Date().toISOString(),
          status: "recorded",
          notes: "Tenant payment created from payments page",
        };

        if (selectedPaymentMethod) {
          payload.method = selectedPaymentMethod.type;
          payload.notes += ` - Selected method: ${getPaymentMethodLabel(selectedPaymentMethod)}`;
        }

        let rec: RentPayment | null = null;

        // Handle Paystack payment with popup
        if (selectedPaymentMethod?.type === "Paystack") {
          const paystackResult = await createPaystackPayment(payload);
          if (!paystackResult?.accessCode) {
            throw new Error("Failed to initialize Paystack payment");
          }

          const paystackPublicKey = (
            apiSettings?.finance as
              | {
                  paymentProviders?: Array<{
                    name?: string;
                    config?: Record<string, unknown>;
                  }>;
                }
              | undefined
          )?.paymentProviders?.find((provider) => provider.name === "Paystack")
            ?.config?.publicKey as string | undefined;

          openPaystackPopup({
            accessCode: paystackResult.accessCode,
            publicKey: paystackPublicKey,
            onLoad: () => {
              setProcessing(false);
            },
            onSuccess: (transaction: any) => {
              setPaystackVerificationState("pending");
              setStep("confirm");
              setProcessing(true);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("paymentsUpdated"));
              }
              void pollPaystackPaymentStatus(
                paystackResult.reference || "",
                (paystackResult.payment as any)?._id ||
                  (paystackResult.payment as any)?.id,
              );
              console.log("Paystack success", transaction);
            },
            onCancel: () => {
              setProcessing(false);
              setStep("confirm");
            },
            onError: (error: any) => {
              console.error("Paystack popup error", error);
              setProcessing(false);
              setStep("confirm");
            },
          });

          return;
        }

        payload.paymentMethod =
          selectedPaymentMethod?.type === "Bank_Transfer"
            ? "bank_transfer"
            : selectedPaymentMethod?.type === "Visa_Mastercard"
              ? "card"
              : "manual";
        rec = await createManualPayment(payload);

        setSavedPayment(rec);
        if (typeof window !== "undefined")
          window.dispatchEvent(new CustomEvent("paymentsUpdated"));
        setTimeout(() => {
          setStep("success");
          setProcessing(false);
        }, 800);
      } catch (err) {
        console.error("Payment error:", err);
        setProcessing(false);
        setTimeout(() => setStep("success"), 800);
      }
    }
  };

  const handlePaymentReset = () => {
    setStep("amount");
    setAmount(defaultRent);
    setPaystackVerificationState("idle");
    if (paymentMethods.length > 0) {
      setMethod(getPaymentMethodId(paymentMethods[0]));
    } else {
      setMethod("");
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [tenant?.id, pageSize]);

  const getPaymentGroup = (payment: PaymentRow) => {
    const groupKey =
      payment.transId || payment.reference || payment.receiptUrl || payment.id;
    return tenantPayments.filter((p) => {
      const compareKey = p.transId || p.reference || p.receiptUrl || p.id;
      return compareKey === groupKey;
    });
  };

  const handlePrintPayment = (payment: PaymentRow) => {
    if (typeof window === "undefined") return;

    const relatedPayments = getPaymentGroup(payment);
    const paymentTitle = `Payment Receipt - ${payment.transId || payment.id}`;
    const totalGroupAmount = relatedPayments.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const paymentDate =
      payment.paidOn || payment.paymentDate || payment.date || "";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${paymentTitle}</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; color: #111; }
            h1 { margin-bottom: 4px; font-size: 24px; }
            p { margin: 4px 0; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
            th { background: #f8fafc; }
            tbody tr:nth-child(even) { background: #f9fafb; }
            .summary { margin-top: 20px; }
            .summary p { margin: 2px 0; }
          </style>
        </head>
        <body>
          <h1>${paymentTitle}</h1>
          <p><strong>Tenant:</strong> ${tenant?.name || "Tenant"}</p>
          <p><strong>Property:</strong> ${currentProperty?.name || "Property"}</p>
          <p><strong>Date:</strong> ${paymentDate}</p>
          <div class="summary">
            <p><strong>Payment Method:</strong> ${payment.method || payment.paymentMethod || "—"}</p>
            <p><strong>Status:</strong> ${payment.status || "—"}</p>
            <p><strong>Total Paid:</strong> ${formatCurrency(totalGroupAmount, activeCurrency)}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Payment Part</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${relatedPayments
                .map(
                  (item, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${formatCurrency(item.amount || 0, activeCurrency)}</td>
                      <td>${item.status || "—"}</td>
                      <td>${item.paidOn || item.paymentDate || item.date || "—"}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handleDownloadPaymentHistory = async () => {
    if (typeof window === "undefined") return;

    const tenantName = tenant?.name || "Tenant";
    const propertyName = currentProperty?.name || "Property";
    const title = `Payment History - ${tenantName}`;

    const pdfTotalPaid = tenantPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0,
    );

    const module = await import("jspdf");
    const { jsPDF } = module;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "letter",
    });
    const margin = 40;
    let cursorY = 48;

    doc.setFontSize(18);
    doc.text(title, margin, cursorY);

    doc.setFontSize(11);
    cursorY += 24;
    doc.text(`Tenant: ${tenantName}`, margin, cursorY);
    doc.text(`Property: ${propertyName}`, 320, cursorY);

    cursorY += 18;
    doc.text(
      `Total Paid: ${formatCurrency(pdfTotalPaid, activeCurrency)}`,
      margin,
      cursorY,
    );
    doc.text(`Downloaded: ${new Date().toLocaleDateString()}`, 320, cursorY);

    cursorY += 28;

    const headers = [
      "Date",
      "Transaction",
      "Amount",
      "Balance",
      "Status",
      "Method",
      "Property",
      "Unit",
    ];
    const columnWidths = [80, 110, 80, 80, 80, 100, 120, 60];
    const rowHeight = 18;
    const pageWidth = doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - margin * 2;
    const totalColumnWidth = columnWidths.reduce(
      (sum, width) => sum + width,
      0,
    );
    const scale = availableWidth / totalColumnWidth;
    const scaledWidths = columnWidths.map((width) => width * scale);

    doc.setFontSize(10);
    doc.setTextColor("#000");
    doc.setDrawColor(200);

    let x = margin;
    headers.forEach((header, index) => {
      doc.text(header, x + 2, cursorY);
      x += scaledWidths[index];
    });

    cursorY += rowHeight;
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY - 10, pageWidth - margin, cursorY - 10);

    if (tenantPayments.length === 0) {
      doc.text("No payment history available.", margin, cursorY + 6);
    }

    tenantPayments.forEach((payment) => {
      if (
        cursorY + rowHeight * 2 >
        doc.internal.pageSize.getHeight() - margin
      ) {
        doc.addPage();
        cursorY = margin;
      }

      x = margin;
      const paymentDate = payment.paidOn || payment.paymentDate || payment.date;
      const row = [
        paymentDate ? new Date(paymentDate).toLocaleDateString() : "—",
        payment.transId || payment.id || "—",
        formatCurrency(payment.amount || 0, activeCurrency),
        formatCurrency(payment.balance || 0, activeCurrency),
        payment.status || "—",
        payment.method || "—",
        propertyName,
        tenant?.unitNumber || "—",
      ];

      row.forEach((cell, index) => {
        doc.text(String(cell), x + 2, cursorY);
        x += scaledWidths[index];
      });
      cursorY += rowHeight;
    });

    const safeName = tenantName
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "-");
    doc.save(`${safeName}-payment-history.pdf`);
  };

  if (!featuresLoaded) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-muted-foreground">
        Loading portal settings...
      </div>
    );
  }

  if (!paymentEnabled) {
    return null;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Payments
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          View payment history and make new payments
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger disabled={false} value="make-payment">
            Make Payment
          </TabsTrigger>
        </TabsList>

        {/* Payment History Tab */}
        <TabsContent value="history" className="space-y-6 md:space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <Card className="border border-border p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">
                Total Paid (YTD)
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {formatCurrency(totalPaid, activeCurrency)}
              </p>
            </Card>

            <Card className="border border-border p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">
                Monthly Rent
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {formatCurrency(defaultRent, activeCurrency)}
              </p>
            </Card>

            <Card className="border border-border p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">
                Payments Made
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {
                  tenantPayments.filter(
                    (p) =>
                      p.status === "complete" ||
                      p.status === "completed" ||
                      p.status === "paid",
                  ).length
                }
              </p>
            </Card>
          </div>

          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-border gap-2 text-foreground bg-transparent"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPaymentHistory}
                className="border-border gap-2 text-foreground flex-1 sm:flex-none bg-transparent"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download PDF</span>
              </Button>
              <Button
                // disabled={false}
                asChild
                className="bg-muted hover:bg-muted/90 text-muted-foreground flex-1 sm:flex-none"
              >
                <Link href="#">Make Payment</Link>
              </Button>
            </div>
          </div>

          {/* Payment History Table */}
          <Card className="border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary border-b border-border">
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Date
                    </th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Trans ID
                    </th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Amount
                    </th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Balance
                    </th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Method
                    </th>
                    <th className="hidden md:table-cell px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Property
                    </th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Unit
                    </th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenantPaymentsData.map((payment) => (
                    <tr
                      key={payment.id}
                      className="hover:bg-secondary transition-colors"
                    >
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground">
                        {(() => {
                          const dateValue =
                            payment.paidOn ||
                            payment.paymentDate ||
                            payment.date;
                          return dateValue
                            ? new Date(dateValue).toLocaleDateString()
                            : "—";
                        })()}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm font-mono text-foreground">
                        {payment.transId || payment.id}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm font-semibold text-foreground">
                        {formatCurrency(payment.amount || 0, activeCurrency)}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm font-semibold text-foreground">
                        {formatCurrency(payment.balance || 0, activeCurrency)}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-0">
                        <Badge
                          className={
                            payment.status === "complete"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs"
                          }
                        >
                          {payment.status === "complete"
                            ? "Paid"
                            : payment.status === "balance"
                              ? "Balance Due"
                              : payment.status || "Pending"}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-sm text-muted-foreground">
                        {payment.method || "—"}
                      </td>
                      <td className="hidden md:table-cell px-4 md:px-6 py-3 md:py-4 text-sm text-muted-foreground">
                        {currentProperty?.name || "—"}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-muted-foreground">
                        {tenant?.unitNumber || "—"}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
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
                              onClick={() => handlePrintPayment(payment)}
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  const text = `Payment ${payment.transId || payment.id}: ${formatCurrency(payment.amount || 0, activeCurrency)}`;
                                  if (navigator.share) {
                                    await navigator.share({
                                      title: "Payment",
                                      text,
                                      url: window.location.href,
                                    });
                                  } else if (navigator.clipboard) {
                                    await navigator.clipboard.writeText(text);
                                    // small feedback
                                    // eslint-disable-next-line no-alert
                                    alert(
                                      "Payment details copied to clipboard",
                                    );
                                  } else {
                                    // fallback
                                    // eslint-disable-next-line no-alert
                                    alert(text);
                                  }
                                } catch (e) {
                                  // eslint-disable-next-line no-console
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
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm text-muted-foreground">
            <p>
              Showing{" "}
              {Math.min(
                (currentPage - 1) * pageSize + 1,
                tenantPaymentsData.length,
              )}
              -{Math.min(currentPage * pageSize, tenantPaymentsData.length)}{" "}
              payments on this page
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1 || isTenantPaymentsLoading}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              >
                Previous
              </Button>
              <span className="text-sm">Page {currentPage}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  isTenantPaymentsLoading ||
                  tenantPaymentsData.length < pageSize
                }
                onClick={() => setCurrentPage((page) => page + 1)}
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
        </TabsContent>

        {/* Make Payment Tab */}
        <TabsContent value="make-payment" className="space-y-6 md:space-y-8">
          {step === "amount" && (
            <Card className="border border-border p-4 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                  Enter Payment Amount
                </h2>

                {/* Amount Quick Select */}
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-3 block">
                      Quick Select
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                      {[
                        { label: "Monthly Rent", value: defaultRent },
                        { label: "Half", value: defaultRent / 2 },
                      ].map((option) => (
                        <Button
                          key={option.label}
                          variant={
                            amount === option.value && option.value > 0
                              ? "default"
                              : "outline"
                          }
                          className={`h-14 md:h-12 text-sm md:text-base ${
                            amount === option.value && option.value > 0
                              ? "bg-primary text-white"
                              : "border-border"
                          }`}
                          onClick={() => {
                            if (option.value > 0) setAmount(option.value);
                            else setAmount(0);
                          }}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">
                              {getCurrencySymbol(activeCurrency)}{" "}
                              {option.value.toLocaleString()}
                            </span>
                            {option.label !== "Custom" && (
                              <span className="text-xs opacity-70">
                                {option.label}
                              </span>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Amount Input */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Custom Amount
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">
                        {formatCurrency(0, activeCurrency).replace(
                          /[0-9.,\s]/g,
                          "",
                        )}
                      </span>
                      <input
                        type="text"
                        value={amount.toLocaleString()}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="flex-1 px-4 py-3 md:py-2 border border-border rounded-lg bg-background text-foreground"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-secondary p-4 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-foreground">
                    <p className="font-medium mb-1">Payment Details</p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Your payment will be processed securely. You will receive
                      a confirmation email immediately after successful payment.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {step === "method" && (
            <Card className="border border-border p-4 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">
                  Select Payment Method
                </h2>

                {hasPaymentMethods ? (
                  <div className="space-y-3">
                    {paymentMethods.map((pm) => {
                      const id = getPaymentMethodId(pm);
                      const isSelected = id === method;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMethod(id)}
                          className={`w-full p-4 border-2 rounded-lg transition-all text-left ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-border"}`}
                            >
                              {isSelected && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm md:text-base">
                                {getPaymentMethodLabel(pm)}
                              </p>
                              <p className="text-xs md:text-sm text-muted-foreground">
                                {getPaymentMethodDescription(pm)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-secondary p-6 text-center">
                    <p className="text-sm text-foreground mb-3">
                      No payment methods are currently enabled.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Please contact your property administrator to enable a
                      payment method.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {step === "details" && (
            <Card className="border border-border p-4 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                  Confirm Payment Details
                </h2>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-secondary p-4">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      {getPaymentMethodLabel(selectedPaymentMethod)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getPaymentMethodDescription(selectedPaymentMethod)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {step === "confirm" && (
            <Card className="border border-border p-4 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">
                  Review Payment
                </h2>

                <div className="bg-secondary p-4 md:p-6 rounded-lg border border-border space-y-4 mb-6">
                  <div>
                    <h3 className="font-semibold text-foreground mb-4">
                      Payment Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Payment Amount
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(amount, activeCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-semibold text-foreground">
                          {getPaymentMethodLabel(selectedPaymentMethod)}
                        </span>
                      </div>
                      <div className="border-t border-border pt-3 flex justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold text-foreground text-base md:text-lg">
                          {formatCurrency(amount, activeCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-900/30">
                  <Lock className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-300">
                    <p className="font-medium mb-1">Secure Payment</p>
                    <p className="text-xs md:text-sm">
                      All transactions are encrypted and secure. Your payment
                      information will never be shared.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {step === "success" && (
            <Card className="border border-border p-4 md:p-8">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-green-600" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                    {selectedPaymentMethod?.type === "Paystack"
                      ? "Payment Processing"
                      : requiresPhoneNumber
                        ? `${getPaymentMethodLabel(selectedPaymentMethod)} Payment Initiated`
                        : "Payment Successful!"}
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base">
                    {selectedPaymentMethod?.type === "Paystack"
                      ? "The Paystack popup is open. Complete the checkout inside the popup to finish your payment securely."
                      : `Your payment of ${formatCurrency(amount, activeCurrency)} has been processed successfully.`}
                  </p>
                </div>

                <div className="bg-secondary p-4 rounded-lg border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Transaction ID
                    </span>
                    <span className="font-mono text-foreground">
                      {savedPayment?.transId ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(amount, activeCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="text-foreground">
                      {savedPayment
                        ? new Date(
                            savedPayment.date ?? new Date().toISOString(),
                          ).toLocaleDateString()
                        : new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs md:text-sm text-muted-foreground">
                  A confirmation email has been sent to{" "}
                  {tenant?.email || "your email"}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="border-border text-foreground flex-1 bg-transparent"
                    onClick={() => setStep("history")}
                  >
                    Back to History
                  </Button>
                  <Button
                    onClick={handlePaymentReset}
                    className="bg-primary hover:bg-primary/90 text-white flex-1"
                  >
                    Make Another Payment
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          {step !== "success" && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (step === "amount") setStep("history");
                  else if (step === "details") setStep("method");
                  else if (step === "method") setStep("amount");
                  else if (step === "confirm") setStep("method");
                }}
                className="border-border text-foreground flex-1"
                disabled={step === "amount"}
              >
                Back
              </Button>
              <Button
                onClick={handlePaymentSubmit}
                disabled={
                  (step === "amount" && amount <= 0) ||
                  (step === "method" && !selectedPaymentMethod) ||
                  (step === "confirm" && processing)
                }
                className="bg-primary hover:bg-primary/90 text-white flex-1"
              >
                {processing ? "Processing..." : "Continue"}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
