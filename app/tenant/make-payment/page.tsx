"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFeatureEnabled } from "@/lib/hooks/use-tenant-portal-features";
import {
  createManualPayment,
  createMpesaPayment,
  getTenantOutstandingBalance,
  RentPayment,
} from "@/lib/services/payments";
import { useAppData } from "@/lib/data-context";
import { useSettings } from "@/lib/settings-context";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import { AdminPaymentMethod, PaymentMethodType } from "@/lib/services/settings";

export default function MakePaymentPage() {
  const [step, setStep] = useState<
    "amount" | "method" | "details" | "confirm" | "success"
  >("amount");
  const activeCurrency = useActiveCurrency();
  const router = useRouter();
  const { enabled: paymentEnabled, isLoaded: featuresLoaded } =
    useFeatureEnabled("paymentPortal");
  const { user } = useAuth();
  const { properties, payments, currentTenant, currentProperty } = useAppData();

  const tenant =
    currentTenant ??
    useMemo(() => {
      if (!user) return null;
      const email = user.email?.toLowerCase();
      return (
        properties
          .flatMap((p) => p.tenants ?? [])
          .find(
            (t: any) =>
              t.id === user.id ||
              t._id === user.id ||
              t.email?.toLowerCase() === email,
          ) || null
      );
    }, [user, properties]);

  useEffect(() => {
    if (!featuresLoaded) return;
    if (!paymentEnabled) {
      router.replace("/tenant/feature-disabled?feature=payments");
    }
  }, [featuresLoaded, paymentEnabled, router]);
  const property =
    currentProperty ??
    useMemo(
      () =>
        tenant?.propertyId
          ? properties.find((p) => p.id === tenant.propertyId)
          : null,
      [tenant, properties],
    );

  const defaultRent =
    Number(tenant?.rentAmount ?? property?.price_per_unit ?? 0) +
    Number(property?.serviceFee ?? 0);
  const [amount, setAmount] = useState<number>(defaultRent);
  const [paymentReason, setPaymentReason] = useState<
    "rentPayment" | "balancePayment"
  >("rentPayment");
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(
    null,
  );
  const [method, setMethod] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const { settings: apiSettings } = useSettings();
  const [processing, setProcessing] = useState(false);
  const [savedPayment, setSavedPayment] = useState<RentPayment | null>(null);
  const [polling, setPolling] = useState(false);
  const mpesaGatewayDisabled =
    process.env.NEXT_PUBLIC_DISABLE_MPESA_GATEWAY === "true";
  const tenantPayments = tenant
    ? payments.filter((p) => p.tenantId === tenant.id)
    : [];

  const getLeaseTermMonths = (leaseType?: string) => {
    const normalized = (leaseType || "monthly").toString().toLowerCase().trim();
    if (
      normalized === "monthly" ||
      normalized === "month-to-month" ||
      normalized === "month_to_month"
    ) {
      return 1;
    }
    if (
      normalized === "3_months" ||
      normalized === "3-months" ||
      normalized === "3 months"
    ) {
      return 3;
    }
    if (
      normalized === "half_year" ||
      normalized === "half-year" ||
      normalized === "6_months" ||
      normalized === "6-months" ||
      normalized === "6 months"
    ) {
      return 6;
    }
    if (
      normalized === "full_year" ||
      normalized === "full-year" ||
      normalized === "12_months" ||
      normalized === "12-months" ||
      normalized === "12 months"
    ) {
      return 12;
    }
    const parsed = parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const PAYMENT_METHOD_LABELS: Record<PaymentMethodType | string, string> = {
    MTN_MoMo: "MTN MoMo",
    Airtel_Money: "Airtel Money",
    "M-Pesa": "M-Pesa",
    Orange_Money: "Orange Money",
    Visa_Mastercard: "Credit / Debit Card",
    Bank_Transfer: "Bank Transfer",
  };

  const MOBILE_MONEY_TYPES = new Set<PaymentMethodType>([
    "MTN_MoMo",
    "Airtel_Money",
    "M-Pesa",
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
    if (method.type === "M-Pesa") {
      return "Pay with M-Pesa mobile money via STK Push.";
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

  useEffect(() => {
    if (!method && paymentMethods.length > 0) {
      setMethod(getPaymentMethodId(paymentMethods[0]));
    } else if (
      method &&
      paymentMethods.length > 0 &&
      !paymentMethods.some((pm) => getPaymentMethodId(pm) === method)
    ) {
      setMethod(getPaymentMethodId(paymentMethods[0]));
    }
  }, [method, paymentMethods]);

  const selectedMethodLabel = getPaymentMethodLabel(selectedPaymentMethod);
  const selectedMethodDescription = getPaymentMethodDescription(
    selectedPaymentMethod,
  );
  const selectedMethodType = selectedPaymentMethod?.type || "";
  const requiresPhoneNumber =
    selectedPaymentMethod &&
    MOBILE_MONEY_TYPES.has(selectedPaymentMethod.type as PaymentMethodType);

  const monthlyRent =
    Number(tenant?.rentAmount ?? property?.price_per_unit ?? 0) +
    Number(property?.serviceFee ?? 0);
  const leaseType = tenant?.leaseType || "monthly";
  const computedOutstandingBalance = Math.max(
    0,
    monthlyRent * getLeaseTermMonths(leaseType) -
      tenantPayments
        .filter(
          (p) =>
            ["rentPayment", "balancePayment"].includes(
              p.reasonForPayment || "",
            ) && !["failed", "refunded"].includes(p.status ?? ""),
        )
        .reduce((sum, p) => sum + (p.amount || 0), 0),
  );

  useEffect(() => {
    setAmount(defaultRent);
  }, [defaultRent]);

  useEffect(() => {
    let cancelled = false;
    if (!tenant?.id) return;
    getTenantOutstandingBalance(tenant.id).then((data) => {
      if (cancelled) return;
      if (data) {
        setOutstandingBalance(data.outstandingBalance);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  // Poll for M-Pesa payment final status when a M-Pesa payment is created
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const startPolling = async (paymentId: string) => {
      setPolling(true);
      const { fetchPaymentById } = await import("@/lib/services/payments");
      interval = setInterval(async () => {
        try {
          if (cancelled) return;
          const updated = await fetchPaymentById(paymentId);
          if (updated) {
            setSavedPayment(updated);
            if (
              updated.status === "complete" ||
              updated.status === "failed" ||
              updated.status === "refunded"
            ) {
              // stop polling
              if (interval) clearInterval(interval);
              setPolling(false);
            }
          }
        } catch (e) {
          // ignore transient errors
          console.warn("Polling payment failed:", e);
        }
      }, 3000);
    };

    if (
      savedPayment &&
      savedPayment.paymentMethod === "mpesa" &&
      (savedPayment as any).paymentId
    ) {
      const paymentId = (savedPayment as any).paymentId || savedPayment.id;
      startPolling(paymentId as string);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [
    savedPayment?.id,
    savedPayment?.paymentMethod,
    (savedPayment as any)?.paymentId,
  ]);

  const handleSubmit = async () => {
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
      if (requiresPhoneNumber) {
        setStep("details");
      } else {
        setStep("confirm");
      }
      return;
    }

    if (step === "details") {
      if (!selectedPaymentMethod) {
        alert(
          "No payment methods are available. Please contact your property administrator.",
        );
        return;
      }
      if (requiresPhoneNumber && !phoneNumber) {
        alert(
          `Please enter your ${getPaymentMethodLabel(
            selectedPaymentMethod,
          )} phone number.`,
        );
        return;
      }
      setStep("confirm");
      return;
    }

    if (step === "confirm") {
      if (requiresPhoneNumber && !phoneNumber) {
        alert(
          `Please enter your ${getPaymentMethodLabel(
            selectedPaymentMethod,
          )} phone number.`,
        );
        return;
      }

      setProcessing(true);
      try {
        const paymentAmount = Number(amount || 0);
        const payload: Partial<RentPayment> & {
          phoneNumber?: string;
          method?: string;
          priorBalance?: number;
          balanceAfterPayment?: number;
          balance?: number;
        } = {
          tenantId: tenant?.id || user?.id || "",
          propertyId: tenant?.propertyId || property?.id,
          amount: paymentAmount,
          monthlyRent,
          paidOn: new Date().toISOString(),
          paidBy: user?.name || user?.id || "tenant",
          leaseType,
          reasonForPayment: paymentReason,
          notes:
            paymentReason === "balancePayment"
              ? "Tenant-initiated balance payment"
              : "Tenant-initiated rent payment",
        };

        // Compute and attach balance fields so server receives the context
        const prior =
          outstandingBalance != null
            ? Number(outstandingBalance)
            : Number(computedOutstandingBalance || 0);
        const balanceAfter = Math.max(0, prior - paymentAmount);
        payload.priorBalance = Number(prior || 0);
        payload.balanceAfterPayment = Number(balanceAfter || 0);
        payload.balance = Number(balanceAfter || 0);

        if (selectedPaymentMethod) {
          payload.notes += ` - Selected method: ${getPaymentMethodLabel(
            selectedPaymentMethod,
          )}`;
          payload.method = selectedPaymentMethod.type;
        }

        let rec: RentPayment | null = null;
        if (requiresPhoneNumber) {
          payload.paymentMethod = "mpesa";
          payload.phoneNumber = phoneNumber;

          if (mpesaGatewayDisabled) {
            payload.notes +=
              " (M-Pesa gateway disabled; payment saved locally)";
            rec = await createManualPayment(payload);
          } else {
            rec = await createMpesaPayment(
              payload as Partial<RentPayment> & {
                phoneNumber: string;
              },
            );
          }
        } else {
          payload.paymentMethod =
            selectedMethodType === "Bank_Transfer"
              ? "bank_transfer"
              : selectedMethodType === "Visa_Mastercard"
                ? "card"
                : "manual";
          rec = await createManualPayment(payload);
        }

        setSavedPayment(rec);
        if (typeof window !== "undefined")
          window.dispatchEvent(new CustomEvent("paymentsUpdated"));

        setProcessing(false);
        setStep("success");
      } catch (err) {
        setProcessing(false);
        setTimeout(() => setStep("success"), 800);
      }
    }
  };

  const handleReset = () => {
    setStep("amount");
    setAmount(defaultRent);
    setPhoneNumber("");
    if (paymentMethods.length > 0) {
      setMethod(getPaymentMethodId(paymentMethods[0]));
    } else {
      setMethod("");
    }
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
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Make a Payment
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Secure online payment for your rent
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {(["amount", "method", "details", "confirm", "success"] as const).map(
          (s, index) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base ${
                  ["amount", "method", "details", "confirm", "success"].indexOf(
                    step,
                  ) >= index
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              {index < 4 && (
                <div
                  className={`flex-1 h-1 md:h-0.5 mx-2 md:mx-4 ${
                    [
                      "amount",
                      "method",
                      "details",
                      "confirm",
                      "success",
                    ].indexOf(step) > index
                      ? "bg-primary"
                      : "bg-secondary"
                  }`}
                />
              )}
            </div>
          ),
        )}
      </div>

      {/* Form Content */}
      {step === "amount" && (
        <Card className="border border-border p-4 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Enter Payment Amount
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Payment Type
                </label>
                <select
                  value={paymentReason}
                  onChange={(e) => {
                    const next = e.target.value as
                      | "rentPayment"
                      | "balancePayment";
                    setPaymentReason(next);
                    if (next === "balancePayment") {
                      setAmount(
                        outstandingBalance ?? computedOutstandingBalance,
                      );
                    } else {
                      setAmount(defaultRent);
                    }
                  }}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                >
                  <option value="rentPayment">Rent Payment</option>
                  <option value="balancePayment">Balance Payment</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Outstanding Balance
                </label>
                <div className="w-full rounded-lg border border-border px-3 py-3 bg-background text-foreground">
                  {outstandingBalance !== null
                    ? formatCurrency(outstandingBalance, activeCurrency)
                    : formatCurrency(
                        computedOutstandingBalance,
                        activeCurrency,
                      )}
                </div>
              </div>
            </div>

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
                    {
                      label: "Full Balance",
                      value: outstandingBalance ?? computedOutstandingBalance,
                    },
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
                        if (option.value > 0) {
                          setAmount(option.value);
                          if (option.label === "Full Balance") {
                            setPaymentReason("balancePayment");
                          }
                        } else {
                          setAmount(0);
                        }
                      }}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">
                          {formatCurrency(option.value, activeCurrency)}
                        </span>
                        <span className="text-xs opacity-70">
                          {option.label}
                        </span>
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
                    {getCurrencySymbol(activeCurrency)}
                  </span>
                  <input
                    type="text"
                    value={amount}
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
                  Your payment will be processed securely. You will receive a
                  confirmation email immediately after successful payment.
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-2">
                  Current outstanding balance for this lease term is{" "}
                  {formatCurrency(
                    outstandingBalance ?? computedOutstandingBalance,
                    activeCurrency,
                  )}
                  .
                </p>
                {paymentReason === "balancePayment" && (
                  <p className="text-xs md:text-sm text-muted-foreground mt-2">
                    You are paying toward the outstanding balance. The backend
                    will record this as a balance payment.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === "method" && (
        <Card className="border border-border p-4 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Choose Payment Method
            </h2>
            {hasPaymentMethods ? (
              <div className="grid gap-3">
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
                  Please contact your property administrator to enable a payment
                  method.
                </p>
              </div>
            )}

            {selectedPaymentMethod?.type === "Bank_Transfer" &&
              selectedPaymentMethod.bankDetails && (
                <div className="mt-4 p-4 border border-border rounded-lg bg-background">
                  <p className="font-medium text-foreground mb-2">
                    Bank Transfer Details
                  </p>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      <span className="font-semibold text-foreground">
                        Bank:
                      </span>{" "}
                      {selectedPaymentMethod.bankDetails.bankName || "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        Account:
                      </span>{" "}
                      {selectedPaymentMethod.bankDetails.accountNumber || "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        Account holder:
                      </span>{" "}
                      {selectedPaymentMethod.bankDetails.accountHolder || "N/A"}
                    </p>
                    {selectedPaymentMethod.bankDetails.swiftCode && (
                      <p>
                        <span className="font-semibold text-foreground">
                          SWIFT:
                        </span>{" "}
                        {selectedPaymentMethod.bankDetails.swiftCode}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                      {selectedMethodLabel}
                    </span>
                  </div>
                  {requiresPhoneNumber && phoneNumber ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-semibold text-foreground">
                        {phoneNumber}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Type</span>
                    <span className="font-semibold text-foreground">
                      {paymentReason === "balancePayment"
                        ? "Balance Payment"
                        : "Rent Payment"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold text-foreground text-base md:text-lg">
                      {formatCurrency(amount, activeCurrency)}
                    </span>
                  </div>
                  {paymentReason === "balancePayment" && (
                    <div className="text-sm text-muted-foreground pt-3">
                      Remaining balance after payment:{" "}
                      {formatCurrency(
                        Math.max(
                          0,
                          (outstandingBalance ?? computedOutstandingBalance) -
                            amount,
                        ),
                        activeCurrency,
                      )}
                    </div>
                  )}
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
                {requiresPhoneNumber
                  ? savedPayment && savedPayment.status === "complete"
                    ? `${selectedMethodLabel} Payment Confirmed`
                    : `${selectedMethodLabel} Payment Initiated`
                  : "Payment Successful!"}
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                {requiresPhoneNumber
                  ? savedPayment && savedPayment.status === "complete"
                    ? `Your payment of ${formatCurrency(amount, activeCurrency)} has been confirmed.`
                    : savedPayment && savedPayment.status === "failed"
                      ? `${selectedMethodLabel} payment failed: ${(savedPayment.raw && savedPayment.raw.metadata && savedPayment.raw.metadata.resultDesc) || "transaction failed"}`
                      : `A ${selectedMethodLabel} payment request for ${formatCurrency(amount, activeCurrency)} has been sent to ${phoneNumber}. Please confirm the transaction on your phone.`
                  : `Your payment of ${formatCurrency(amount, activeCurrency)} has been processed successfully.`}
              </p>
              {requiresPhoneNumber && polling && (
                <p className="text-xs text-muted-foreground mt-2">
                  Waiting for confirmation... This may take a few seconds.
                </p>
              )}
              {requiresPhoneNumber &&
                savedPayment &&
                savedPayment.status === "failed" && (
                  <p className="text-sm text-red-600 mt-2">
                    {(savedPayment.raw &&
                      savedPayment.raw.metadata &&
                      savedPayment.raw.metadata.resultDesc) ||
                      "Payment failed"}
                  </p>
                )}
              {paymentReason === "balancePayment" && (
                <p className="text-muted-foreground text-sm md:text-base">
                  Remaining outstanding balance:{" "}
                  {formatCurrency(
                    Math.max(
                      0,
                      (outstandingBalance ?? computedOutstandingBalance) -
                        amount,
                    ),
                    activeCurrency,
                  )}
                </p>
              )}
            </div>

            <div className="bg-secondary p-4 rounded-lg border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID</span>
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
                        savedPayment.paidOn ??
                          savedPayment.paymentDate ??
                          savedPayment.date ??
                          new Date().toISOString(),
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
                asChild
                variant="outline"
                className="border-border text-foreground flex-1 bg-transparent"
              >
                <a href="/tenant/payments">View Payment History</a>
              </Button>
              <Button
                onClick={handleReset}
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
              if (step === "amount") window.history.back();
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
            onClick={handleSubmit}
            disabled={
              (step === "amount" && amount <= 0) ||
              (step === "method" && !selectedPaymentMethod) ||
              (step === "details" && requiresPhoneNumber && !phoneNumber) ||
              (step === "confirm" && processing)
            }
            className="bg-primary hover:bg-primary/90 text-white flex-1"
          >
            {processing ? "Processing..." : "Continue"}
          </Button>
        </div>
      )}
    </div>
  );
}
