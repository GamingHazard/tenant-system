import { apiRequest } from "../query-client";
import { buildQueryParams, QueryOptions } from "@/lib/api-utils";
import {
  getCollection,
  insertIntoCollection,
  generateId,
  removeFromCollection,
  updateInCollection,
} from "@/lib/local-store";
import { getProperty } from "@/lib/services/properties";
import { getTenant, updateTenant } from "@/lib/services/tenants";

function dispatchPaymentsUpdatedEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("paymentsUpdated"));
  }
}

const isMpesaGatewayDisabled =
  process.env.NEXT_PUBLIC_DISABLE_MPESA_GATEWAY === "true";

function normalizePaymentAmount(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function isSettledPaymentStatus(status: string) {
  return [
    "complete",
    "completed",
    "paid",
    "settled",
    "confirmed",
    "recorded",
  ].includes(String(status || "").toLowerCase());
}

function isRentRelatedPayment(payment: any) {
  const key = String(payment.reasonForPayment || payment.paymentType || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return key.includes("rent") || key.includes("balance");
}

function applyTenantStatusFromPayment(payment: any) {
  if (!payment?.tenantId) return;

  const tenant = getTenant(payment.tenantId);
  if (!tenant) return;

  if (!isSettledPaymentStatus(payment.status)) return;
  if (!isRentRelatedPayment(payment)) return;

  const paid = normalizePaymentAmount(
    payment.amount ??
      payment.total ??
      payment.value ??
      payment.amountPaid ??
      payment.paymentAmount,
  );
  const property = getProperty(tenant.propertyId);
  const rent =
    normalizePaymentAmount(tenant.rentAmount ?? 0) +
    normalizePaymentAmount(property?.serviceFee ?? 0);
  const balanceAfterPayment = normalizePaymentAmount(
    payment.balanceAfterPayment ?? payment.balance ?? 0,
  );

  if (balanceAfterPayment === 0 && paid > 0) {
    updateTenant(tenant.id, { status: "paid" });
  } else if (rent > 0 && paid >= rent) {
    updateTenant(tenant.id, { status: "paid" });
  } else if (paid > 0) {
    updateTenant(tenant.id, { status: "balance" });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tenantsUpdated"));
  }
}

export type PaymentReasonFor =
  | "securityDeposit"
  | "rentPayment"
  | "balancePayment";
export type RentPaymentStatus =
  | "complete"
  | "balance"
  | "pending"
  | "failed"
  | "refunded"
  | "recorded"
  | "confirmed";

export interface RentPayment {
  id: string;
  tenantId: string;
  propertyId: string;
  txdId?: string;
  transId?: string;
  amount: number;
  paymentMethod:
    | "cash"
    | "bank_transfer"
    | "check"
    | "card"
    | "manual"
    | "mpesa";
  leaseType?: string;
  paidOn: string;
  paidBy?: string;
  reasonForPayment?: PaymentReasonFor;
  notes?: string;
  balance?: number;
  priorBalance?: number;
  balanceAfterPayment?: number;
  balancePeriod?: string;
  status?: RentPaymentStatus;
  currency?: string;
  monthlyRent?: number;
  receiptUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  raw?: any;
  reference?: string;
  recordedBy?: string;
  paymentDate?: string;
  method?: string;
  date?: string;
}

export async function createManualPayment(
  payload: Partial<RentPayment>,
): Promise<RentPayment | null> {
  try {
    // Debug: log the outgoing payload so we can verify balance fields
    try {
      console.log("[createManualPayment] outgoing payload:", payload);
    } catch (e) {
      // ignore logging errors in older browsers
    }
    const res = await apiRequest("POST", "/payments/create", payload);
    const data = await res.json();
    const raw = data?.data || data?.payment || data || null;
    if (!raw) return null;
    const record = mapServerPaymentToClient(raw);
    applyTenantStatusFromPayment(record);
    dispatchPaymentsUpdatedEvent();

    // Dispatch tenant notification for payment received
    if (record.tenantId && isSettledPaymentStatus(record.status)) {
      const tenant = getTenant(record.tenantId);
      if (tenant && typeof window !== "undefined") {
        // Dispatch async to avoid blocking the payment creation flow
        (async () => {
          try {
            const { dispatchTenantNotification } =
              await import("@/lib/services/notification-dispatcher");
            await dispatchTenantNotification({
              type: "paymentReceived",
              tenant,
              data: {
                paymentId: record.id,
                amount: record.amount,
                transactionId: record.transId || record.id,
                paymentDate: new Date().toLocaleDateString(),
                currency: "USD",
              },
            });
          } catch (error) {
            console.error(
              "[Payment Service] Failed to dispatch payment notification:",
              error,
            );
          }
        })();
      }
    }

    return record;
  } catch (err) {
    console.warn("Failed to create manual payment:", err);
    return null;
  }
}

export async function createMpesaPayment(
  payload: Partial<RentPayment> & { phoneNumber: string },
): Promise<RentPayment | null> {
  try {
    if (isMpesaGatewayDisabled) {
      console.warn(
        "[Payment Service] M-Pesa gateway disabled via NEXT_PUBLIC_DISABLE_MPESA_GATEWAY; saving payment locally.",
      );
      return await createManualPayment({
        ...payload,
        paymentMethod: "mpesa",
        notes:
          `${payload.notes || ""}`.trim() +
          " (M-Pesa gateway disabled; payment saved locally)",
      });
    }

    // Debug: log the outgoing payload for initiate calls
    try {
      console.log("[createMpesaPayment] initiate payload:", payload);
    } catch (_) {}
    const res = await apiRequest("POST", "/payments/mpesa/initiate", payload);
    const json = await res.json();
    const raw = json?.data || json?.payment || json || null;
    if (!raw) return null;

    // Attach API-provided ids for client polling
    raw._api_paymentId = json?.paymentId || raw._id || raw.id;
    raw._checkoutRequestID =
      json?.checkoutRequestID || raw?.metadata?.checkoutRequestID;

    const record = mapServerPaymentToClient(raw);
    // expose these helper fields on the client object
    (record as any).paymentId = raw._api_paymentId;
    (record as any).checkoutRequestID = raw._checkoutRequestID;
    (record as any).customerMessage = json?.customerMessage || null;

    applyTenantStatusFromPayment(record);
    dispatchPaymentsUpdatedEvent();
    return record;
  } catch (err) {
    console.warn("Failed to initiate M-Pesa payment:", err);
    return null;
  }
}

export async function fetchPaymentById(
  paymentId: string,
): Promise<RentPayment | null> {
  try {
    const res = await apiRequest(
      "GET",
      `/payments/${encodeURIComponent(paymentId)}`,
    );
    const data = await res.json();
    const raw = data?.data || data || null;
    if (!raw) return null;
    const record = mapServerPaymentToClient(raw);
    applyTenantStatusFromPayment(record);
    return record;
  } catch (err) {
    console.warn(`Failed to fetch payment ${paymentId}:`, err);
    return null;
  }
}

export async function updatePayment(
  id: string,
  updates: Partial<RentPayment>,
): Promise<RentPayment | null> {
  try {
    const res = await apiRequest(
      "PUT",
      `/payments?id=${encodeURIComponent(id)}`,
      updates,
    );
    const data = await res.json();
    const raw = data?.data || data?.payment || data || null;
    if (!raw) return null;
    const record = mapServerPaymentToClient(raw);
    applyTenantStatusFromPayment(record);
    dispatchPaymentsUpdatedEvent();

    // Dispatch tenant notification if status changed to settled
    if (
      record.tenantId &&
      isSettledPaymentStatus(record.status) &&
      isSettledPaymentStatus(updates.status || "")
    ) {
      const tenant = getTenant(record.tenantId);
      if (tenant && typeof window !== "undefined") {
        (async () => {
          try {
            const { dispatchTenantNotification } =
              await import("@/lib/services/notification-dispatcher");
            await dispatchTenantNotification({
              type: "paymentReceived",
              tenant,
              data: {
                paymentId: record.id,
                amount: record.amount,
                transactionId: record.transId || record.id,
                paymentDate: new Date().toLocaleDateString(),
                currency: "USD",
              },
            });
          } catch (error) {
            console.error(
              "[Payment Service] Failed to dispatch payment notification:",
              error,
            );
          }
        })();
      }
    }

    return record;
  } catch (err) {
    console.warn("Failed to update payment:", err);
    return null;
  }
}

export async function getAllPayments(
  propertyId: string,
  token?: string,
): Promise<RentPayment[]> {
  return getPaymentsForProperty(propertyId, token);
}

export async function deletePaymentApi(id: string): Promise<boolean> {
  try {
    await apiRequest("DELETE", `/payments/${id}/delete`);
    // dispatchPaymentsUpdatedEvent();
    return true;
  } catch (err) {
    console.warn(`Failed to delete payment ${id}:`, err);
    return false;
  }
}

export async function getTenantOutstandingBalance(tenantId: string): Promise<{
  outstandingBalance: number;
  totalPaid: number;
  totalOwed: number;
  expectedRent: number;
  currency: string;
} | null> {
  const fallbackCompute = () => {
    const tenant = getTenant(tenantId);
    if (!tenant) return null;

    const property = tenant.propertyId ? getProperty(tenant.propertyId) : null;
    const monthlyRent = Number(
      tenant.rentAmount ??
        property?.price_per_unit ??
        (property as any)?.monthlyRent ??
        0,
    );
    const leaseType = tenant.leaseType || "monthly";
    const normalizeLeaseTermMonths = (leaseTypeValue: string) => {
      const normalized = String(leaseTypeValue).toLowerCase().trim();
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

    const expectedRent = monthlyRent * normalizeLeaseTermMonths(leaseType);
    const allPayments = getCollection<any>("payments");
    const totalPaid = allPayments
      .filter(
        (payment) =>
          payment.tenantId === tenantId &&
          ["rentPayment", "balancePayment"].includes(
            payment.reasonForPayment,
          ) &&
          !["failed", "refunded"].includes(payment.status),
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      outstandingBalance: Math.max(0, expectedRent - totalPaid),
      totalPaid,
      totalOwed: expectedRent,
      expectedRent,
      currency:
        (tenant as any)?.currency || (property as any)?.currency || "USD",
    };
  };

  try {
    const res = await apiRequest(
      "GET",
      `/payments/tenant/${encodeURIComponent(tenantId)}/balance`,
    );
    const data = await res.json();
    const raw = data?.data || data;
    if (!res.ok || raw?.outstandingBalance == null) {
      return fallbackCompute();
    }
    return {
      outstandingBalance: Number(raw?.outstandingBalance ?? 0),
      totalPaid: Number(raw?.totalPaid ?? 0),
      totalOwed: Number(raw?.totalOwed ?? 0),
      expectedRent: Number(raw?.expectedRent ?? 0),
      currency: raw?.currency || "USD",
    };
  } catch (err) {
    console.warn("Failed to fetch tenant outstanding balance:", err);
    return fallbackCompute();
  }
}

export const PAYMENT_LIST_FIELDS = [
  "id",
  "_id",
  "tenantId",
  "propertyId",
  "amount",
  "currency",
  "paidOn",
  "paymentDate",
  "date",
  "status",
  "paymentMethod",
  "method",
  "transId",
  "receiptUrl",
  "reference",
  "balance",
  "priorBalance",
  "balanceAfterPayment",
  "reasonForPayment",
];

export interface ListPaymentsOptions extends QueryOptions {
  token?: string;
}

export async function getPaymentsForTenant(
  tenantId: string,
  options?: ListPaymentsOptions | string,
): Promise<RentPayment[]> {
  const token = typeof options === "string" ? options : options?.token;
  const params = buildQueryParams({
    fields: typeof options === "object" ? options?.fields : undefined,
    page: typeof options === "object" ? options?.page : undefined,
    limit: typeof options === "object" ? options?.limit : undefined,
    sort: typeof options === "object" ? options?.sort : undefined,
  });

  try {
    const res = await apiRequest(
      "GET",
      `/payments/tenant/${encodeURIComponent(tenantId)}/all`,
      params,
      token,
    );
    const data = await res.json();
    const rawList: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.payments)
        ? data.payments
        : Array.isArray(data)
          ? data
          : [];
    return rawList
      .map((raw: any) => mapServerPaymentToClient(raw))
      .filter((payment): payment is RentPayment => payment !== null);
  } catch (err) {
    console.warn(
      "Failed to fetch payments for tenant via API, falling back to local store:",
      err,
    );
    try {
      const local = getCollection("payments") as any[];
      return local
        .filter((p) => p.tenantId === tenantId)
        .map((p) => ({
          id: p.id,
          tenantId: p.tenantId,
          propertyId: p.propertyId ?? "",
          amount: Number(p.amount || 0),
          currency: p.currency || "USD",
          paidOn: p.paidOn || p.date || new Date().toISOString(),
        })) as RentPayment[];
    } catch (e) {
      return [];
    }
  }
}

export async function listPaymentsApi(
  options?: ListPaymentsOptions,
): Promise<RentPayment[]> {
  const params = buildQueryParams({
    fields: options?.fields,
    page: options?.page,
    limit: options?.limit,
    sort: options?.sort,
    search: options?.search,
    status: options?.status,
  });

  try {
    const res = await apiRequest(
      "GET",
      "/payments/all",
      params,
      options?.token,
    );
    const data = await res.json();
    const rawList: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.payments)
        ? data.payments
        : Array.isArray(data)
          ? data
          : [];
    return rawList
      .map((raw: any) => mapServerPaymentToClient(raw))
      .filter((payment): payment is RentPayment => payment !== null);
  } catch (err) {
    console.warn(
      "Failed to fetch payments via API, falling back to local store:",
      err,
    );
    try {
      const local = listPayments();
      return local.map((p) => ({
        id: p.id,
        tenantId: p.tenantId || "",
        propertyId: p.propertyId || "",
        amount: Number(p.amount || 0),
        currency: p.currency || "USD",
        paidOn: p.paidOn || p.date || new Date().toISOString(),
        status: p.status || "complete",
        paymentMethod: p.paymentMethod || "manual",
      })) as RentPayment[];
    } catch (e) {
      return [];
    }
  }
}

export async function getPaymentsForProperty(
  propertyIdOrIds: string | string[],
  options?: ListPaymentsOptions | string,
): Promise<RentPayment[]> {
  const token = typeof options === "string" ? options : options?.token;
  const propertyIds = Array.isArray(propertyIdOrIds)
    ? propertyIdOrIds.filter(Boolean)
    : [propertyIdOrIds];

  if (propertyIds.length === 0) {
    return [];
  }

  if (propertyIds.length > 1) {
    // Use server-side batch endpoint to fetch payments for multiple properties
    try {
      const sortedIds = [...propertyIds].sort();
      const payload = {
        propertyIds: sortedIds,
        filters: { limitPerProperty: 100 },
      };
      const res = await apiRequest("POST", "/payments/batch", payload, token);
      const data = await res.json();
      const map = data?.data || {};
      const all: any[] = Object.values(map).flat();
      return all
        .map((raw: any) => mapServerPaymentToClient(raw))
        .filter((p): p is RentPayment => p !== null);
    } catch (error) {
      console.warn(
        "Failed to fetch batch payments for properties, falling back to per-property calls:",
        error,
      );
      const allPayments = await Promise.all(
        propertyIds.map(async (propertyId) => {
          try {
            return await getPaymentsForProperty(propertyId, token);
          } catch (error) {
            console.warn(
              `Failed to fetch payments for property ${propertyId}:`,
              error,
            );
            return [] as RentPayment[];
          }
        }),
      );
      return allPayments.flat();
    }
  }

  const propertyId = propertyIds[0];
  if (!propertyId) {
    return [];
  }

  try {
    const params = buildQueryParams({
      fields: typeof options === "object" ? options?.fields : undefined,
      page: typeof options === "object" ? options?.page : undefined,
      limit: typeof options === "object" ? options?.limit : undefined,
      sort: typeof options === "object" ? options?.sort : undefined,
    });
    const res = await apiRequest(
      "GET",
      `/payments/property/${encodeURIComponent(propertyId)}/all`,
      params,
      token,
    );
    const data = await res.json();

    const rawList: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.payments)
        ? data.payments
        : Array.isArray(data)
          ? data
          : [];

    return rawList
      .map((raw: any) => mapServerPaymentToClient(raw))
      .filter((payment): payment is RentPayment => payment !== null);
  } catch (err) {
    console.warn(
      "Failed to fetch payments for property via API, falling back to local store:",
      err,
    );
    try {
      const local = listPayments();
      return local
        .filter((p) => p.propertyId === propertyId)
        .map((p) => ({
          id: p.id,
          tenantId: p.tenantId || "",
          propertyId: p.propertyId || "",
          amount: Number(p.amount || 0),
          currency: p.currency || "USD",
          paidOn: p.paidOn || p.date || new Date().toISOString(),
          status: p.status || "complete",
          paymentMethod: p.paymentMethod || "manual",
        })) as RentPayment[];
    } catch (e) {
      return [];
    }
  }
}

function mapServerPaymentToClient(p: any): any {
  if (!p) return null;

  const id = p._id || p.id || (p._doc && p._doc._id);
  const txdId = p.txdId || p.transId || p.reference || p.receiptReference || id;
  const tenantId =
    typeof p.tenantId === "object"
      ? p.tenantId?._id || p.tenantId?.id
      : p.tenantId;
  const propertyId =
    typeof p.propertyId === "object"
      ? p.propertyId?._id || p.propertyId?.id
      : p.propertyId;
  const rawAmount =
    p.amount ?? p.total ?? p.value ?? p.paymentAmount ?? p.amountPaid ?? 0;
  const amount = Number(String(rawAmount).replace(/[^0-9.-]+/g, "")) || 0;
  const currency = p.currency || "USD";
  const paymentMethod = p.paymentMethod || p.method || p.payment_type || "";
  const paidOn =
    p.paidOn ||
    p.paymentDate ||
    p.date ||
    p.createdAt ||
    new Date().toISOString();
  const paidBy =
    p.paidBy ||
    (typeof p.recordedBy === "object"
      ? p.recordedBy._id || p.recordedBy.id
      : p.recordedBy) ||
    null;
  const reasonForPayment =
    p.reasonForPayment ||
    (p.paymentType === "security_deposit"
      ? "securityDeposit"
      : p.paymentType === "rent"
        ? "rentPayment"
        : undefined);
  const balance = Number(p.balance ?? 0);
  const priorBalance = Number(p.priorBalance ?? 0);
  const balanceAfterPayment = Number(p.balanceAfterPayment ?? 0);
  const balancePeriod = p.balancePeriod || null;
  let status = p.status || "pending";
  if (["recorded", "confirmed", "completed", "paid"].includes(status))
    status = "complete";
  if (["pending", "balance"].includes(status)) status = "balance";
  if (status === "refunded") status = "refunded";

  return {
    id,
    txdId,
    transId: txdId,
    tenantId,
    propertyId,
    amount,
    currency,
    paidOn,
    paymentDate: paidOn,
    date: paidOn,
    paidBy,
    reasonForPayment,
    balance,
    priorBalance,
    balanceAfterPayment,
    balancePeriod,
    paymentMethod,
    method: paymentMethod,
    status,
    receiptUrl: p.receiptUrl || p.receiptURL || p.receipt || null,
    reference: p.reference || null,
    notes: p.notes || p.note || p.reference || null,
    recordedBy: p.recordedBy || p.recorded_by || null,
    leaseType: p.leaseType || p.lease_type || null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    raw: p,
  } as RentPayment;
}

function generateShortId(len = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export interface PaymentRecord {
  id: string;
  txdId: string;
  transId: string;
  tenantId: string;
  propertyId?: string;
  unit?: string;
  amount: number;
  price_per_unit?: number;
  monthlyRent?: number;
  currency?: string;
  date: string;
  paidOn?: string;
  paidBy?: string;
  paymentMethod?: string;
  method?: string;
  reasonForPayment?: "securityDeposit" | "rentPayment" | "balancePayment";
  paymentType?:
    | "rent"
    | "commercial"
    | "residential"
    | "misc"
    | "security_deposit";
  leaseType?: string;
  paymentDate?: string;
  lease_start?: string;
  lease_type?: string;
  description?: string;
  balance?: number;
  note?: string;
  reference?: string;
  raw?: any;
  total?: number;
  value?: number;
  paymentAmount?: number;
  amountPaid?: number;
  commercialPaymentDetails?: {
    baseRent?: number;
    additionalRent?: number;
    percentageRent?: number;
    escalation?: string;
  };
  residentialPaymentDetails?: {
    petFee?: number;
    parkingFee?: number;
    utilitiesIncluded?: boolean;
  };
  paymentPlan?: {
    installments?: number;
    frequency?: "weekly" | "biweekly" | "monthly" | "quarterly";
  };
  autoPay?: boolean;
  status?:
    | "pending"
    | "completed"
    | "failed"
    | "complete"
    | "balance"
    | "refunded"
    | "paid";
  receiptReference?: string;
  receiptUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function listPayments(): PaymentRecord[] {
  return getCollection<PaymentRecord>("payments");
}

export function getPayment(id: string): PaymentRecord | null {
  return listPayments().find((payment) => payment.id === id) ?? null;
}

export function updateLocalPayment(
  id: string,
  patch: Partial<PaymentRecord>,
): PaymentRecord | null {
  const updated = updateInCollection<PaymentRecord>("payments", id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  if (updated) {
    applyTenantStatusFromPayment(updated);
    dispatchPaymentsUpdatedEvent();
  }

  return updated;
}

export function deletePayment(id: string): boolean {
  return removeFromCollection("payments", id);
}

export function createPayment(
  payload: Partial<PaymentRecord> & { monthlyRent?: number },
): PaymentRecord {
  const now = new Date().toISOString();
  const rec: PaymentRecord = {
    id: generateId("pay"),
    txdId: payload.txdId ?? generateShortId(8),
    transId: payload.txdId ?? payload.transId ?? generateShortId(8),
    tenantId: payload.tenantId || "",
    propertyId: payload.propertyId,
    unit: payload.unit,
    amount: payload.amount ?? 0,
    price_per_unit: payload.price_per_unit,
    currency: payload.currency ?? "USD",
    date: payload.date ?? now,
    paidOn: payload.paidOn ?? payload.paymentDate ?? payload.date ?? now,
    paidBy: payload.paidBy,
    paymentMethod: payload.paymentMethod ?? payload.method ?? "offline",
    method: payload.method ?? payload.paymentMethod ?? "offline",
    reasonForPayment:
      payload.reasonForPayment ||
      (payload.paymentType === "security_deposit"
        ? "securityDeposit"
        : payload.paymentType === "rent"
          ? "rentPayment"
          : undefined),
    status: payload.status ?? "complete",
    note: payload.note,
    reference: payload.reference,
    raw: payload.raw,
    lease_start: payload.lease_start,
    lease_type: payload.lease_type ?? payload.leaseType,
    balance: payload.balance ?? 0,
    receiptReference: payload.receiptReference,
    receiptUrl: payload.receiptUrl,
    createdAt: now,
    updatedAt: now,
  };
  insertIntoCollection("payments", rec);

  applyTenantStatusFromPayment(rec);
  dispatchPaymentsUpdatedEvent();

  return rec;
}
