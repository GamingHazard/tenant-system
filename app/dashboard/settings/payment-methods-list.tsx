"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminPaymentMethod, PaymentMethodType } from "@/lib/services/settings";
import { Edit2, Trash2, Plus, ToggleLeft, ToggleRight } from "lucide-react";

interface PaymentMethodsListProps {
  paymentMethods: AdminPaymentMethod[];
  onEdit: (method: AdminPaymentMethod) => void;
  onDelete: (methodId: string) => void;
  onToggleEnable: (methodId: string, enabled: boolean) => void;
  onAddNew: () => void;
  deletingId?: string | null;
  togglingId?: string | null;
  isSaving?: boolean;
}

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

const getMethodIcon = (type: PaymentMethodType): string => {
  const icons: Record<PaymentMethodType, string> = {
    MTN_MoMo: "/mtn.png",
    Airtel_Money: "/airtel.png",
    Orange_Money: "/orange.png",
    Visa_Mastercard: "/cards.png",
    Bank_Transfer: "/bank.png",
    Paystack: "/paystack.png",
  };
  return icons[type];
};

const maskAccountNumber = (accountNumber?: string): string => {
  if (!accountNumber) return "Not configured";
  if (accountNumber.length <= 4) return accountNumber;
  return `****${accountNumber.slice(-4)}`;
};

export function PaymentMethodsList({
  paymentMethods,
  onEdit,
  onDelete,
  onToggleEnable,
  onAddNew,
  deletingId,
  togglingId,
  isSaving,
}: PaymentMethodsListProps) {
  if (!paymentMethods || paymentMethods.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mb-4 text-4xl">💳</div>
            <p className="mb-2 font-semibold">No payment methods configured</p>
            <p className="mb-4 text-sm text-gray-500">
              Add payment methods to enable tenants to pay rent through your
              preferred channels
            </p>
            <Button onClick={onAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Configured Payment Methods</h3>
        <Button variant="outline" size="sm" onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paymentMethods.map((method) => (
          <Card key={method._id} className="relative overflow-hidden">
            {/* Status Badge */}
            <div className="absolute right-4 top-4">
              <Badge
                variant={method.enabled ? "default" : "secondary"}
                className="flex items-center gap-1"
              >
                {method.enabled ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Active
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                    Inactive
                  </>
                )}
              </Badge>
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="">
                  <img
                    className={`w-10 h-10 object-contain rounded ${
                      method.enabled ? "grayscale-0" : "grayscale"
                    } ${method.type === "Airtel_Money" ? "w-15 h-15" : ""} transition-all`}
                    src={getMethodIcon(method.type)}
                    alt={getDisplayName(method.type)}
                  />
                </div>
                <div className="flex-1 pr-16">
                  <CardTitle className="text-lg">
                    {getDisplayName(method.type)}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pb-4">
              {/* Transaction Number - Mobile Money */}
              {method.transactionNumber && (
                <div>
                  <p className="text-xs font-semibold text-gray-600">
                    Transaction Number
                  </p>
                  <p className="font-mono text-sm">
                    {method.transactionNumber}
                  </p>
                </div>
              )}

              {/* Bank Details - Bank Transfer & Visa */}
              {method.bankDetails && (
                <div>
                  <p className="text-xs font-semibold text-gray-600">
                    Bank Account
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-600">Holder:</span>{" "}
                      {method.bankDetails.accountHolder || "N/A"}
                    </p>
                    <p>
                      <span className="text-gray-600">Account:</span>{" "}
                      {maskAccountNumber(method.bankDetails.accountNumber)}
                    </p>
                    <p>
                      <span className="text-gray-600">Bank:</span>{" "}
                      {method.bankDetails.bankName || "N/A"}
                    </p>
                    {method.bankDetails.swiftCode && (
                      <p>
                        <span className="text-gray-600">SWIFT:</span>{" "}
                        {method.bankDetails.swiftCode}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 border-t pt-3">
                <Button
                  variant={method.enabled ? "ghost" : "outline"}
                  size="sm"
                  onClick={() =>
                    onToggleEnable(method._id || "", !method.enabled)
                  }
                  className="flex-1"
                  disabled={
                    Boolean(togglingId === method._id) || Boolean(isSaving)
                  }
                >
                  {togglingId === method._id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {method.enabled ? "Disabling..." : "Enabling..."}
                    </>
                  ) : method.enabled ? (
                    <>
                      <ToggleRight className="mr-2 h-4 w-4" />
                      Disable
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="mr-2 h-4 w-4" />
                      Enable
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(method)}
                  disabled={
                    Boolean(isSaving) || Boolean(deletingId === method._id)
                  }
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(method._id || "")}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={
                    Boolean(deletingId === method._id) || Boolean(isSaving)
                  }
                >
                  {deletingId === method._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
