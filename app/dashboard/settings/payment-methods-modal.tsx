"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BankSelector from "@/components/bank-selector";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AdminPaymentMethod,
  BankDetails,
  PaymentMethodType,
} from "@/lib/services/settings";

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (method: AdminPaymentMethod) => void;
  onDelete?: (methodId: string) => void;
  editingMethod?: AdminPaymentMethod;
  isSaving?: boolean;
  isDeleting?: boolean;
  country?: string;
}

// Limit available methods to Paystack only for payout/subaccount creation
const PAYMENT_METHOD_TYPES: PaymentMethodType[] = ["Paystack"];

const MOBILE_MONEY_TYPES: PaymentMethodType[] = [];

// Treat Paystack as a bank-type method for collecting account details
const BANK_PAYMENT_TYPES: PaymentMethodType[] = ["Paystack"];

const getDisplayName = (type: PaymentMethodType): string => {
  const names: Record<PaymentMethodType, string> = {
    MTN_MoMo: "MTN MoMo",
    Airtel_Money: "Airtel Money",
    Orange_Money: "Orange Money",
    Visa_Mastercard: "Visa/Mastercard",
    Bank_Transfer: "Bank Transfer",
    Paystack: "Paystack",
  };
  return names[type];
};

export function PaymentMethodsModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingMethod,
  isSaving,
  isDeleting,
  country,
}: PaymentMethodsModalProps) {
  const [formData, setFormData] = useState<AdminPaymentMethod>({
    type: "Paystack",
    enabled: false,
  });

  const [bankDetails, setBankDetails] = useState<BankDetails>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingMethod) {
      setFormData(editingMethod);
      setBankDetails(editingMethod.bankDetails || {});
    } else {
      setFormData({ type: "Paystack", enabled: false });
      setBankDetails({});
    }
    setErrors({});
  }, [editingMethod, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    // For Paystack, require bank account details
    if (BANK_PAYMENT_TYPES.includes(formData.type)) {
      if (!bankDetails.accountNumber?.trim()) {
        newErrors.accountNumber = "Account number is required";
      }
      if (!bankDetails.accountHolder?.trim()) {
        newErrors.accountHolder = "Account holder is required";
      }
      if (!bankDetails.bankCode?.trim()) {
        newErrors.bankCode = "Bank is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    // Build a method payload compatible with server expectations:
    // - keep `bankDetails` for UI/local use
    // - add top-level `bank.code`, `accountNumber`, and `businessName` so
    //   the server can create Paystack subaccounts when settings are saved
    const method: AdminPaymentMethod = {
      ...formData,
      bankDetails: BANK_PAYMENT_TYPES.includes(formData.type)
        ? bankDetails
        : undefined,
      transactionNumber: MOBILE_MONEY_TYPES.includes(formData.type)
        ? formData.transactionNumber
        : undefined,
    } as AdminPaymentMethod;

    const submit = async () => {
      if (BANK_PAYMENT_TYPES.includes(formData.type)) {
        // call API to create Paystack subaccount immediately
        try {
          const resp = await fetch("/api/settings/paystack-recipients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessName: bankDetails.accountHolder || undefined,
              bankCode: bankDetails.bankCode || "",
              accountNumber: bankDetails.accountNumber,
              percentageCharge: 0,
            }),
          });

          const payload = await resp.json();
          if (!resp.ok || !payload?.success) {
            throw new Error(
              payload?.error?.message || "Failed to create subaccount",
            );
          }

          // service returns { recipient, subaccountCode, rawResponse } or recipient
          const created = payload.data;
          const subaccountCode =
            created.subaccountCode ||
            created.subaccount_code ||
            created.recipient?.subaccountCode ||
            created.recipient?.subaccount_code;
          if (subaccountCode) {
            method.subaccountCode = subaccountCode;
          }

          // show confirmation to admin
          window.alert(
            `Paystack subaccount created: ${subaccountCode || "(created)"}`,
          );
        } catch (err: any) {
          console.error("Failed to create Paystack subaccount:", err);
          window.alert(
            "Failed to create Paystack subaccount. Settings will still be saved, but please verify bank details.",
          );
        }
      }

      onSave(method);
      onClose();
    };

    void submit();
  };

  const handleDelete = () => {
    if (editingMethod?._id && onDelete) {
      onDelete(editingMethod._id);
      onClose();
    }
  };

  const handleTypeChange = (value: string) => {
    setFormData({
      ...formData,
      type: value as PaymentMethodType,
    });
    setErrors({});
  };

  const handleTransactionNumberChange = (value: string) => {
    setFormData({
      ...formData,
      transactionNumber: value,
    });
  };

  const handleBankDetailChange = (field: keyof BankDetails, value: string) => {
    setBankDetails({
      ...bankDetails,
      [field]: value,
    });
  };

  const isMobileMoneyType = MOBILE_MONEY_TYPES.includes(formData.type);
  const isBankType = BANK_PAYMENT_TYPES.includes(formData.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingMethod ? "Edit Payment Method" : "Add Payment Method"}
          </DialogTitle>
          <DialogDescription>
            Configure payment method details and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Method Type Select */}
          <div className="space-y-2">
            <Label htmlFor="payment-type">Payment Method</Label>
            <Select value={formData.type} onValueChange={handleTypeChange}>
              <SelectTrigger id="payment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getDisplayName(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction Number - Mobile Money Only */}
          {isMobileMoneyType && (
            <div className="space-y-2">
              <Label htmlFor="transaction-number">
                Transaction Number / Business Short Code
              </Label>
              <Input
                id="transaction-number"
                placeholder="e.g., 123456 or +256700000000"
                value={formData.transactionNumber || ""}
                onChange={(e) => handleTransactionNumberChange(e.target.value)}
                className={errors.transactionNumber ? "border-red-500" : ""}
              />
              {errors.transactionNumber && (
                <p className="text-sm text-red-500">
                  {errors.transactionNumber}
                </p>
              )}
              <p className="text-xs text-gray-500">
                For {getDisplayName(formData.type)}, provide the business short
                code or till number
              </p>
            </div>
          )}

          {/* Bank Details - Bank Transfer & Visa Only */}
          {isBankType && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Bank Details</h3>

              <div className="space-y-2">
                <Label htmlFor="account-holder">Account Holder Name</Label>
                <Input
                  id="account-holder"
                  placeholder="Full name on account"
                  value={bankDetails.accountHolder || ""}
                  onChange={(e) =>
                    handleBankDetailChange("accountHolder", e.target.value)
                  }
                  className={errors.accountHolder ? "border-red-500" : ""}
                />
                {errors.accountHolder && (
                  <p className="text-sm text-red-500">{errors.accountHolder}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-number">Account Number</Label>
                <Input
                  id="account-number"
                  placeholder="Account number"
                  value={bankDetails.accountNumber || ""}
                  onChange={(e) =>
                    handleBankDetailChange("accountNumber", e.target.value)
                  }
                  className={errors.accountNumber ? "border-red-500" : ""}
                />
                {errors.accountNumber && (
                  <p className="text-sm text-red-500">{errors.accountNumber}</p>
                )}
              </div>

              <div className="space-y-2">
                <BankSelector
                  value={bankDetails.bankCode}
                  onChange={(code) => handleBankDetailChange("bankCode", code)}
                  country={country}
                />
                {errors.bankCode && (
                  <p className="text-sm text-red-500">{errors.bankCode}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="swift-code">SWIFT Code</Label>
                  <Input
                    id="swift-code"
                    placeholder="Optional"
                    value={bankDetails.swiftCode || ""}
                    onChange={(e) =>
                      handleBankDetailChange("swiftCode", e.target.value)
                    }
                  />
                  <p className="text-xs text-gray-500">
                    International transfers
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="routing-number">Routing Number</Label>
                  <Input
                    id="routing-number"
                    placeholder="Optional"
                    value={bankDetails.routingNumber || ""}
                    onChange={(e) =>
                      handleBankDetailChange("routingNumber", e.target.value)
                    }
                  />
                  <p className="text-xs text-gray-500">US transfers</p>
                </div>
              </div>
            </div>
          )}

          {/* Enabled Toggle */}
          <div className="flex items-center space-x-2 border-t pt-4">
            <Checkbox
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  enabled: Boolean(checked),
                })
              }
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Enable this payment method for tenants
            </Label>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {editingMethod?._id && onDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                type="button"
                disabled={Boolean(isDeleting)}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            )}
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={Boolean(isSaving)}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingMethod ? "Updating..." : "Adding..."}
                </>
              ) : (
                <>{editingMethod ? "Update" : "Add"} Method</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
