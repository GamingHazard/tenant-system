"use client";

import React from "react";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, DollarSign, Calendar, Tag } from "lucide-react";
import { createTransaction } from "@/app/lib/transactions-client";
import { createExpenseApi, type ExpenseRecord } from "@/lib/services/expenses";
import { useAppData } from "@/lib/data-context";
import { currencies } from "@/lib/data/currencies";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";

interface AddExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: ExpenseRecord) => void;
  mode?: "simple" | "full";
  initialTenantId?: string;
  initialPropertyId?: string;
  maintenanceRequestId?: string;
}

interface ExpenseFormData {
  category: string;
  expenseType: "residential" | "commercial" | "both";
  amount: string;
  date: string;
  description: string;
  property: string;
  receiptReference?: string;
  unit?: string;
  paymentMethod?: string;
  currency: string;
  paymentSourceType?: "card" | "bank" | "other" | "";
  paymentSourceProvider?: string;
  paymentSourceLast4?: string;
  notes?: string;
  vendorId?: string;
  vendorName?: string;
  invoiceNumber?: string;
  dueDate?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvalDate?: string;
  recurringFrequency?: "weekly" | "monthly" | "quarterly" | "yearly";
  autoPay: boolean;
}

export default function AddExpenseForm({
  isOpen,
  onClose,
  onSubmit,
  mode = "full",
  initialTenantId,
  initialPropertyId,
  maintenanceRequestId,
}: AddExpenseFormProps) {
  const activeCurrency = useActiveCurrency();

  const [formData, setFormData] = useState<ExpenseFormData>({
    category: "maintenance",
    expenseType: "commercial",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    property: initialPropertyId || "",
    receiptReference: "",
    unit: "",
    paymentMethod: "",
    currency: activeCurrency,
    paymentSourceType: "",
    paymentSourceProvider: "",
    paymentSourceLast4: "",
    notes: "",
    vendorId: "",
    vendorName: "",
    invoiceNumber: "",
    dueDate: "",
    requiresApproval: false,
    approvedBy: "",
    approvalDate: "",
    recurringFrequency: "monthly",
    autoPay: false,
  });

  const { properties, tenants } = useAppData();
  const [availableUnits, setAvailableUnits] = useState<string[] | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState(
    initialTenantId || "",
  );

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (name === "property") {
      const prop = properties.find((p) => p.id === value);
      if (prop && Array.isArray(prop.units) && prop.units.length > 0) {
        const normalizedUnits = prop.units
          .map((unit) => {
            if (typeof unit === "string") return unit;
            if (unit && typeof unit === "object") {
              return String(
                (unit as any).unitNumber ||
                  (unit as any).unit ||
                  (unit as any).name ||
                  "",
              );
            }
            return "";
          })
          .filter((unit) => unit);

        setAvailableUnits(normalizedUnits);
        if (normalizedUnits.length === 1) {
          setFormData((prev) => ({
            ...prev,
            property: value,
            unit: normalizedUnits[0],
          }));
          return;
        }
      } else {
        setAvailableUnits(null);
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expense = await createExpenseApi({
        amount: parseFloat(formData.amount) || 0,
        category: formData.category,
        expenseType: formData.expenseType,
        description: formData.description,
        propertyId: formData.property || undefined,
        date: formData.date,
        currency: formData.currency,
        receiptReference: formData.receiptReference || undefined,
        unitNumber: formData.unit || undefined,
        paymentMethod: formData.paymentMethod || undefined,
        paymentSourceType: formData.paymentSourceType || undefined,
        paymentSourceProvider: formData.paymentSourceProvider || undefined,
        paymentSourceLast4: formData.paymentSourceLast4 || undefined,
        vendorId: formData.vendorId || undefined,
        vendorName: formData.vendorName || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        dueDate: formData.dueDate || undefined,
        requiresApproval: formData.requiresApproval,
        approvedBy: formData.approvedBy || undefined,
        approvalDate: formData.approvalDate || undefined,
        recurringFrequency: formData.recurringFrequency || undefined,
        autoPay: formData.autoPay,
        notes: formData.notes || undefined,
        status: "completed",
      });

      createTransaction({
        tenantId: mode === "simple" ? selectedTenantId || undefined : undefined,
        amount: expense.amount,
        type: "expense",
        description: expense.description,
        propertyId: expense.propertyId,
        status: expense.status,
        category: expense.category,
        date: expense.date,
        currency: expense.currency,
        receiptReference: expense.receiptReference,
        unit: formData.unit || undefined,
        paymentMethod: expense.paymentMethod,
        paymentSource: expense.paymentSourceType
          ? {
              type: expense.paymentSourceType,
              provider: expense.paymentSourceProvider,
              last4: expense.paymentSourceLast4,
            }
          : undefined,
        vendorName: expense.vendorName,
        invoiceNumber: expense.invoiceNumber,
        dueDate: expense.dueDate,
        requiresApproval: expense.requiresApproval,
        approvedBy: expense.approvedBy,
        approvalDate: expense.approvalDate,
        notes: expense.notes,
        metadata: { expenseId: expense.id, maintenanceRequestId },
      });
      onSubmit?.(expense);
    } catch (err) {
      console.error("Failed to create expense", err);
    }
    setFormData({
      category: "maintenance",
      expenseType: "commercial",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      property: "",
      receiptReference: "",
      unit: "",
      paymentMethod: "",
      currency: "USD",
      paymentSourceType: "",
      paymentSourceProvider: "",
      paymentSourceLast4: "",
      notes: "",
      vendorId: "",
      vendorName: "",
      invoiceNumber: "",
      dueDate: "",
      requiresApproval: false,
      approvedBy: "",
      approvalDate: "",
      recurringFrequency: "monthly",
      autoPay: false,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {mode === "simple" ? "Record Expense" : "Add Expense"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "simple"
                  ? "Approve maintenance and record expense details"
                  : "Record a new property expense"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Expense Category
                </div>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="maintenance">Maintenance & Repairs</option>
                <option value="utilities">Utilities</option>
                <option value="insurance">Insurance</option>
                <option value="property-tax">Property Tax</option>
                <option value="cleaning">Cleaning & Services</option>
                <option value="legal">Legal & Compliance</option>
                <option value="management">Management Fees</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Amount
                </div>
              </label>
              <Input
                type="text"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Date
                </div>
              </label>
              <Input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            {/* Tenant (shown only in simple mode) */}
            {mode === "simple" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tenant
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Expense Type (hidden in simple mode) */}
            {mode === "full" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Expense Type
                </label>
                <select
                  name="expenseType"
                  value={formData.expenseType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="commercial">Commercial</option>
                  <option value="residential">Residential</option>
                  <option value="both">Both</option>
                </select>
              </div>
            )}

            {/* Property */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Property
              </label>
              <select
                name="property"
                value={formData.property}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select Property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit (conditional) */}
            {availableUnits && availableUnits.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Unit
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="">Select Unit</option>
                  {availableUnits.map((u, idx) => (
                    <option key={idx} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="">Select Method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>

            {/* Advanced Fields (hidden in simple mode) */}
            {mode === "full" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Currency
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    >
                      {currencies.map((currency) => (
                        <option
                          key={`${currency.code}-${currency.country}`}
                          value={currency.code}
                        >
                          {currency.code} — {currency.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Payment Source
                    </label>
                    <select
                      name="paymentSourceType"
                      value={formData.paymentSourceType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    >
                      <option value="">Select Source</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Payment Provider
                    </label>
                    <Input
                      name="paymentSourceProvider"
                      value={formData.paymentSourceProvider}
                      onChange={handleChange}
                      placeholder="Stripe, Plaid, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Card Last 4
                    </label>
                    <Input
                      name="paymentSourceLast4"
                      value={formData.paymentSourceLast4}
                      onChange={handleChange}
                      placeholder="1234"
                    />
                  </div>
                </div>

                {/* Vendor Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Vendor Name
                    </label>
                    <Input
                      name="vendorName"
                      value={formData.vendorName}
                      onChange={handleChange}
                      placeholder="Vendor name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Invoice #
                    </label>
                    <Input
                      name="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={handleChange}
                      placeholder="Invoice number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Due Date
                    </label>
                    <Input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Approval Required
                    </label>
                    <select
                      name="requiresApproval"
                      value={String(formData.requiresApproval)}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          requiresApproval: e.target.value === "true",
                        }))
                      }
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                </div>

                {formData.requiresApproval && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Approved By
                      </label>
                      <Input
                        name="approvedBy"
                        value={formData.approvedBy}
                        onChange={handleChange}
                        placeholder="Approver name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Approval Date
                      </label>
                      <Input
                        type="date"
                        name="approvalDate"
                        value={formData.approvalDate}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Recurring Frequency
                    </label>
                    <select
                      name="recurringFrequency"
                      value={formData.recurringFrequency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Auto-pay
                    </label>
                    <select
                      name="autoPay"
                      value={String(formData.autoPay)}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          autoPay: e.target.value === "true",
                        }))
                      }
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                </div>

                {/* Notes (full mode only) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes
                  </label>
                  <Textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Internal notes or additional context"
                    className="h-20"
                  />
                </div>
              </>
            )}

            {/* Description (visible in both modes) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the expense..."
                className="h-20"
                required
              />
            </div>

            {/* Receipt/Invoice Reference (visible in both modes) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Receipt/Invoice Reference
              </label>
              <Input
                name="receiptReference"
                value={formData.receiptReference}
                onChange={handleChange}
                placeholder="Receipt number or file name"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-border text-foreground bg-transparent"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                {mode === "simple" ? "Approve" : "Add Expense"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
