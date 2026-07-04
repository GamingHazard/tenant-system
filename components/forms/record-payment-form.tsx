"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAppData } from "@/lib/data-context";
import {
  createManualPayment,
  getTenantOutstandingBalance,
} from "@/lib/services/payments";
import { currencies } from "@/lib/data/currencies";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";

type Props = {
  tenantId?: string | null;
  propertyId?: string | null;
  onSuccess?: (payment: any) => void;
  onCancel?: () => void;
};

export default function RecordPaymentForm({
  tenantId: initialTenantId = null,
  propertyId: initialPropertyId = null,
  onSuccess,
  onCancel,
}: Props) {
  const { tenants, properties } = useAppData();
  const activeCurrency = useActiveCurrency();

  const [tenantId, setTenantId] = useState<string | null>(initialTenantId);
  const [propertyId, setPropertyId] = useState<string | null>(
    initialPropertyId,
  );
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>(activeCurrency);
  const [monthlyRent, setMonthlyRent] = useState<number | null>(null);
  const [paidOn, setPaidOn] = useState<string>(
    new Date().toISOString().slice(0, 16),
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("manual");
  const [status, setStatus] = useState<string>("complete");
  const [leaseType, setLeaseType] = useState<string>("monthly");
  const [paidBy, setPaidBy] = useState<string>("");
  const [reasonForPayment, setReasonForPayment] =
    useState<string>("rentPayment");
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(
    null,
  );
  const [balance, setBalance] = useState<string>("0");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantId) {
      const t = tenants.find((x: any) => x.id === tenantId);
      const rent = Number(
        (t as any)?.rentAmount || (t as any)?.monthlyRent || 0,
      );
      const prop = properties.find(
        (p: any) =>
          p.id === (t as any).propertyId || p._id === (t as any).propertyId,
      );
      const serviceFee = Number(prop?.serviceFee ?? 0);
      const total = rent + serviceFee;
      if (total > 0) setMonthlyRent(total);

      // Auto-fill property if tenant has a propertyId
      if ((t as any)?.propertyId && !propertyId) {
        setPropertyId((t as any).propertyId);
      }

      if ((t as any)?.currentBalance && (t as any).currentBalance > 0) {
        setOutstandingBalance((t as any).currentBalance);
      }
    }
    if (!tenantId && initialTenantId) setTenantId(initialTenantId as string);
    if (!propertyId && initialPropertyId)
      setPropertyId(initialPropertyId as string);
  }, [tenantId, initialTenantId, initialPropertyId, tenants, propertyId]);

  // Fetch tenant's outstanding balance on tenant selection and store it
  useEffect(() => {
    let cancelled = false;
    if (tenantId) {
      getTenantOutstandingBalance(tenantId).then((data) => {
        if (cancelled) return;
        if (data && data.outstandingBalance > 0) {
          setOutstandingBalance(data.outstandingBalance);
          // If the current reason is balancePayment, show outstanding balance
          if (reasonForPayment === "balancePayment") {
            setBalance(data.outstandingBalance.toLocaleString());
          }
        } else {
          setOutstandingBalance(null);
          // no outstanding balance -> reset displayed balance to 0 or monthlyRent
          if (reasonForPayment === "balancePayment") setBalance("0");
        }
      });
    } else {
      setOutstandingBalance(null);
      setBalance("0");
    }
    return () => {
      cancelled = true;
    };
  }, [tenantId, reasonForPayment]);

  // Auto-calculate displayed balance as: outstandingBalance - amount (if present)
  // otherwise monthlyRent - amount. Update live as `amount` changes.
  useEffect(() => {
    const amountNum = Number(amount) || 0;

    if (outstandingBalance !== null) {
      const newBal = Math.max(0, outstandingBalance - amountNum);
      setBalance(newBal.toLocaleString());
      return;
    }

    if (monthlyRent !== null) {
      const newBal = Math.max(0, monthlyRent - amountNum);
      setBalance(newBal.toLocaleString());
      return;
    }

    // fallback
    setBalance("0");
  }, [amount, outstandingBalance, monthlyRent]);

  useEffect(() => {
    setCurrency(activeCurrency);
  }, [activeCurrency]);

  // Create tenant options for searchable select
  const tenantOptions = useMemo(() => {
    return tenants.map((t: any) => ({
      value: t.id,
      label: t.name || "Unknown Tenant",
      description: `${t.unitNumber || "N/A"} — ${t.email || "No email"}`,
    }));
  }, [tenants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return alert("Please select a tenant");
    if (!amount || Number(amount) <= 0)
      return alert("Please enter a valid amount");

    setSaving(true);

    let uploadedReceiptUrl = undefined;

    const payload: any = {
      tenantId,
      propertyId,
      amount: Number(amount),
      currency,
      monthlyRent: monthlyRent ?? undefined,
      serviceFee:
        properties.find((p: any) => p.id === propertyId || p._id === propertyId)
          ?.serviceFee ?? 0,
      paymentMethod,
      paidOn,
      leaseType: leaseType || undefined,
      paidBy: paidBy || undefined,
      reasonForPayment,
      balance: Number(balance),
      notes: notes || undefined,
    };

    // Attach balance context so backend can persist correct balances for partial payments
    const amountNum = Number(amount) || 0;
    const prior =
      outstandingBalance !== null
        ? Number(outstandingBalance)
        : Number(monthlyRent ?? 0);
    const balanceAfter = Math.max(0, prior - amountNum);
    payload.priorBalance = Number(prior || 0);
    payload.balanceAfterPayment = Number(balanceAfter || 0);
    // allow explicit balance override for security deposits
    payload.balance =
      reasonForPayment === "securityDeposit"
        ? Number(balance)
        : Number(balanceAfter || 0);
    if (reasonForPayment === "securityDeposit") {
      payload.status = status;
    }

    const created = await createManualPayment(payload);
    setSaving(false);

    if (created) {
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("paymentsUpdated"));
      onSuccess?.(created);
    } else {
      alert("Failed to record payment. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Tenant
          </label>
          <SearchableSelect
            options={tenantOptions}
            value={tenantId}
            onValueChange={setTenantId}
            placeholder="Search tenant..."
            emptyMessage="No tenant found."
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Property
          </label>
          <select
            value={propertyId || ""}
            onChange={(e) => setPropertyId(e.target.value || null)}
            className="w-full border border-border rounded px-3 py-2 bg-transparent"
          >
            <option value="">Select property</option>
            {properties.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Amount
          </label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 bg-transparent"
          >
            {currencies.map((currencyOption) => (
              <option
                key={`${currencyOption.code}-${currencyOption.country}`}
                value={currencyOption.code}
              >
                {currencyOption.code} — {currencyOption.currency}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Paid On
          </label>
          <Input
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            type="datetime-local"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 bg-transparent"
          >
            <option value="manual">Manual</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="check">Check</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="hidden  ">
          <label className="text-xs text-muted-foreground block mb-1">
            Payment Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full hidden border border-border rounded px-3 py-2 bg-transparent"
            disabled={true}
          >
            <option value="complete">Complete</option>
            <option value="balance">Balance</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Reason for Payment
          </label>
          <select
            value={reasonForPayment}
            onChange={(e) => setReasonForPayment(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 bg-transparent"
          >
            <option value="rentPayment">Rent Payment</option>
            <option value="securityDeposit">Security Deposit</option>
            <option value="balancePayment">Balance Payment</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Lease Type
          </label>
          <Input
            value={leaseType}
            onChange={(e) => setLeaseType(e.target.value)}
            placeholder="Monthly, annual, etc."
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Paid By
          </label>
          <Input
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            placeholder="Name of payer"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            {outstandingBalance !== null
              ? "Remaining Balance"
              : "Balance (Auto-calculated)"}
          </label>
          <Input
            value={balance}
            readOnly
            placeholder="0.00"
            className="bg-slate-50"
          />
          {outstandingBalance !== null && (
            <div className="mt-1 text-xs text-muted-foreground">
              Outstanding: ${outstandingBalance.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* reference and receipt fields removed — handled by backend */}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Notes
        </label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => onCancel?.()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
