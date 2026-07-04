import {
  getCollection,
  insertIntoCollection,
  updateInCollection,
  removeFromCollection,
  generateId,
} from "@/lib/local-store";
import {
  notifyNewProperty,
  notifyPropertyUpdated,
} from "@/lib/services/notifications";
import { listTenants, TenantRecord } from "@/lib/services/tenants";
import { getCategoryForType } from "@/lib/constants/property-types";
import { apiRequest, queryClient } from "../query-client";
import { buildQueryParams, QueryOptions } from "@/lib/api-utils";
import { useAuth } from "../auth-context";
import { use } from "react";

export interface PropertySpecification {
  title: string;
  value: string;
}

export interface UnitImage {
  name: string;
  url: string;
  public_id: string;
}

export interface UnitDetails {
  unitNumber: string;
  rent: number;
  unitType?: string;
  specifications?: PropertySpecification[];
  images?: UnitImage[];
}

export interface PropertyRecord {
  id: string;
  _id?: string;
  name: string;
  address: string;
  city: string;
  country: string;
  category?: string;
  units_available: number;
  units: Array<string | UnitDetails>;
  price_per_unit: number;
  customizeUnits?: boolean;
  customUnitNumbers?: string;
  detailedUnits?: UnitDetails[];
  type?: string;
  propertyType?:
    | "residential"
    | "commercial"
    | "mixed_use"
    | "industrial"
    | "retail"
    | "office"
    | "apartment"
    | "house"
    | "villa"
    | "condo"
    | "townhouse"
    | "duplex"
    | "mixed-use"
    | "warehouse"
    | "hotel"
    | "restaurant"
    | "shopping-center"
    | "medical"
    | "flex-space"
    | "other";
  autoGenerateUnitNumbers?: boolean;
  geography?: string;
  images?: { url: string; public_id: string }[];
  features?: string[];
  specifications?: PropertySpecification[];
  description?: string;
  tenants?: string[] | TenantRecord[]; // tenant ids or populated tenant objects
  occupancy?: number;
  monthlyRevenue?: number;
  location?: {
    lat: number;
    lng: number;
  };
  zoning?: string;
  permittedUses?: string[];
  annualPropertyTaxes?: number;
  annualInsurance?: number;
  appraisedValue?: number;
  lastAppraisalDate?: string;
  noi?: number;
  capRate?: number;
  estate?: string;
  policies?: {
    petPolicy?: { allowed?: boolean; details?: string };
    parkingPolicy?: { allowed?: boolean; details?: string };
    leasePolicy?: string;
    otherPolicies?: { title: string; body: string }[];
  };
  serviceFee?: number;
}

function makePrefix(name: string, city: string, country: string) {
  const a = (name || "X").trim()[0] || "X";
  const b = (city || "X").trim()[0] || "X";
  const c = (country || "X").trim()[0] || "X";
  return `${String(a).toUpperCase()}${String(b).toUpperCase()}${String(c).toUpperCase()}`;
}

export function generateUnitNumbers(
  name: string,
  city: string,
  country: string,
  count: number,
) {
  const prefix = makePrefix(name, city, country);
  const units: string[] = [];
  for (let i = 1; i <= count; i++) {
    units.push(`${prefix}-${i}`);
  }
  return units;
}

export function normalizePropertyRecord(property: any): PropertyRecord {
  const normalized = {
    ...property,
    id: property.id || property._id || "",
  } as PropertyRecord;

  if (Array.isArray(normalized.units)) {
    normalized.units = normalized.units.map((unit: any) => {
      if (typeof unit === "string") {
        return {
          unitNumber: unit,
          rent: Number(normalized.price_per_unit ?? 0),
          unitType: "",
          specifications: [],
        } as any;
      }

      return {
        unitNumber: unit.unitNumber || unit.unit || "",
        rent: Number(unit.rent ?? unit.price ?? normalized.price_per_unit ?? 0),
        unitType: unit.unitType || unit.type || "",
        specifications: Array.isArray(unit.specifications)
          ? unit.specifications
          : [],
        images: Array.isArray(unit.images)
          ? unit.images.map((image: any) => ({
              name: image?.name ?? "",
              url: image?.url ?? image?.secure_url ?? "",
              public_id: image?.public_id ?? image?.publicId ?? "",
            }))
          : [],
      } as any;
    });
  }

  if (Array.isArray(normalized.tenants)) {
    normalized.tenants = normalized.tenants.map((tenant: any) => ({
      ...tenant,
      id: tenant.id || tenant._id,
    }));
  }

  return normalized;
}

export interface ListPropertiesOptions extends QueryOptions {
  token?: string;
}

export const PROPERTY_LIST_FIELDS = [
  "id",
  "_id",
  "name",
  "address",
  "city",
  "country",
  "category",
  "units_available",
  "price_per_unit",
  "units",
  "detailedUnits",
  "propertyType",
  "type",
  "tenants",
  "occupancy",
  "monthlyRevenue",
  "images",
  "description",
  "serviceFee",
];

export async function listPropertiesApi(
  adminId: string,
  options?: ListPropertiesOptions,
): Promise<PropertyRecord[]> {
  const endpoint = `/property/${adminId}/all`;
  const params = buildQueryParams({
    fields: options?.fields,
    page: options?.page,
    limit: options?.limit,
    sort: options?.sort,
  });

  try {
    const res = await apiRequest("GET", endpoint, params, options?.token);
    const data = await res.json();

    const rawProperties = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.properties)
          ? data.properties
          : Array.isArray(data?.data?.properties)
            ? data.data.properties
            : Array.isArray(data?.property)
              ? data.property
              : [];

    return rawProperties.map(normalizePropertyRecord);
  } catch (err) {
    console.warn(
      "Failed to fetch properties from API, falling back to local store:",
      err,
    );
    return listProperties();
  }
}

export function listProperties(): PropertyRecord[] {
  return getCollection<PropertyRecord>("properties").map(
    normalizePropertyRecord,
  );
}

export function getProperty(id: string): PropertyRecord | null {
  return (
    getCollection<PropertyRecord>("properties").find(
      (p) => p.id === id || p._id === id,
    ) ?? null
  );
}

export async function getPropertyById(
  id: string,
  token?: string,
): Promise<PropertyRecord> {
  const response = await apiRequest("GET", `/property/${id}`, undefined, token);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch property");
  }

  const payload = await response.json();
  const propertyData = payload?.property || payload?.data || payload || null;

  if (!propertyData) {
    throw new Error("Property response did not contain expected data");
  }

  return normalizePropertyRecord(propertyData);
}

export function getAvailablePropertiesWithUnits() {
  const properties = listProperties();
  const tenants = listTenants();

  return properties.map((property) => {
    const rawUnits =
      Array.isArray(property.units) && property.units.length > 0
        ? property.units
        : generateUnitNumbers(
            property.name ?? "",
            property.city ?? "",
            property.country ?? "",
            (property as any).units_available ??
              (property as any).unitsAvailable ??
              property.units?.length ??
              1,
          );

    const unitRecords = Array.isArray(rawUnits)
      ? rawUnits.map((unit) =>
          typeof unit === "string"
            ? {
                unitNumber: unit,
                rent: property.price_per_unit ?? 0,
                unitType: "",
                specifications: [],
                images: [],
              }
            : unit,
        )
      : [];

    const unitNumbers = unitRecords.map((unit) => unit.unitNumber);

    // Find tenants assigned to this property
    const propertyTenants = tenants.filter(
      (tenant) => tenant.propertyId === property._id,
    );
    // Get occupied units (be defensive about tenant unit field names)
    const occupiedUnits = propertyTenants
      .map(
        (tenant) =>
          (tenant as any).unit ??
          (tenant as any).unitNumber ??
          (tenant as any).unit_no,
      )
      .filter(Boolean);

    // Get available units
    const availableUnits = unitNumbers.filter(
      (unit) => !occupiedUnits.includes(unit),
    );

    return {
      ...property,
      units: unitRecords,
      availableUnits,
      hasAvailableUnits: availableUnits.length > 0,
    };
  });
}

export async function createProperty(
  payload: Partial<PropertyRecord>,
  token?: any,
  user?: any,
): Promise<PropertyRecord> {
  const id = generateId("prop");
  const units_available = payload.units_available ?? 1;
  const name = payload.name ?? "Property";
  const city = payload.city ?? "";
  const country = payload.country ?? "";
  const units = Array.isArray(payload.units)
    ? payload.units
    : generateUnitNumbers(name, city, country, units_available);

  const payLoad = {
    name,
    address: payload.address ?? "",
    city,
    country,
    category:
      payload.category ??
      getCategoryForType(payload.propertyType ?? (payload.type as string)) ??
      "residential",
    estate: payload.estate,
    units_available,
    units,
    price_per_unit: payload.price_per_unit ?? 0,
    customizeUnits: payload.customizeUnits,
    autoGenerateUnitNumbers: payload?.autoGenerateUnitNumbers,
    customUnitNumbers: payload.customUnitNumbers,
    detailedUnits: payload.detailedUnits,
    propertyType:
      payload.propertyType ??
      (payload.type as PropertyRecord["propertyType"]) ??
      "residential",
    geography: payload.geography,
    images: payload.images ?? [],
    features: payload.features ?? [],
    specifications: payload.specifications ?? [],
    description: payload.description ?? "",
    tenants: [],
    location: payload.location,
    zoning: payload.zoning,
    permittedUses: payload.permittedUses,
    annualPropertyTaxes: payload.annualPropertyTaxes,
    annualInsurance: payload.annualInsurance,
    appraisedValue: payload.appraisedValue,
    lastAppraisalDate: payload.lastAppraisalDate,
    noi: payload.noi,
    capRate: payload.capRate,
    serviceFee: payload.serviceFee,
    policies: payload.policies,
  };

  const res = await apiRequest(
    "POST",
    `/property/create/${user?._id || user?.id}`,
    payLoad,
  );

  const data = await res.json();

  const newProperty = {
    ...data.property,
    id: data.property._id,
  };

  insertIntoCollection("properties", newProperty);
  queryClient.setQueryData<PropertyRecord[]>(["properties"], (current) =>
    current ? [newProperty, ...current] : listProperties(),
  );
  queryClient.invalidateQueries({ queryKey: ["properties"], exact: false });

  // Notify about new property
  notifyNewProperty(newProperty.name, newProperty.id);

  return newProperty;
}

export async function updateProperty(
  id: string,
  patch: Partial<PropertyRecord>,
): Promise<PropertyRecord | null> {
  const existingProperty = getProperty(id);
  const finalPatch: Partial<PropertyRecord> = { ...patch };

  if (patch.units_available !== undefined && patch.units === undefined) {
    const name = patch.name ?? existingProperty?.name ?? "";
    const city = patch.city ?? existingProperty?.city ?? "";
    const country = patch.country ?? existingProperty?.country ?? "";
    finalPatch.units = generateUnitNumbers(
      name,
      city,
      country,
      patch.units_available,
    );
  }

  const res = await apiRequest("PUT", `/property/${id}/update`, finalPatch);
  if (!res.ok) {
    console.error("Failed to update property", await res.text());
    return null;
  }

  const updated = updateInCollection<PropertyRecord>(
    "properties",
    id,
    finalPatch,
  );
  if (updated) {
    queryClient.setQueryData<PropertyRecord[]>(["properties"], (current) =>
      current
        ? current.map((property) =>
            property.id === updated.id ? { ...property, ...updated } : property,
          )
        : [updated],
    );
    queryClient.invalidateQueries({ queryKey: ["properties"], exact: false });

    const changedFields = Object.keys(finalPatch).filter(
      (key) => finalPatch[key as keyof PropertyRecord] !== undefined,
    );

    try {
      const allTenants = listTenants();
      const propertyTenantIds = allTenants
        .filter((tenant) => {
          const tenantId = tenant?.id || tenant?._id;
          return (
            tenant.propertyId === id ||
            tenant.propertyId === existingProperty?._id ||
            (tenantId != null && existingProperty?.tenants?.includes(tenantId))
          );
        })
        .map((tenant) => tenant.id);

      if (propertyTenantIds.length > 0 && changedFields.length > 0) {
        notifyPropertyUpdated(
          updated.name,
          updated.id,
          changedFields,
          propertyTenantIds,
        );
      }
    } catch (error) {
      console.error("Failed to notify property update to tenants", error);
    }
  }

  return updated;
}

export async function deleteProperty(
  id: string,
  adminPassword: string,
  token?: string,
): Promise<boolean> {
  try {
    const res = await apiRequest(
      "DELETE",
      `/property/${id}/delete`,
      {
        password: adminPassword,
      },
      token,
    );

    if (!res.ok) {
      const errorMessage = await res.text();
      console.error("Failed to delete property", res.status, errorMessage);
      return false;
    }

    // Get the property before deletion to find associated tenants
    const propertyToDelete = getProperty(id);
    if (!propertyToDelete) {
      console.warn(
        "Property not found in local store, skipping cascade delete",
      );
      removeFromCollection("properties", id);
      return true;
    }

    // Get all associated tenant IDs
    const allTenants = getCollection("tenants");
    const associatedTenantIds = allTenants
      .filter(
        (t) =>
          t.propertyId === id ||
          t.propertyId === propertyToDelete._id ||
          propertyToDelete.tenants?.includes(t?.id || t?._id || ""),
      )
      .map((t) => t.id);

    // Delete all related data in correct order (children first, then property)

    // 1. Delete messages related to this property or its tenants
    const messages = getCollection("messages");
    const filteredMessages = messages.filter(
      (m: any) =>
        m.propertyId !== id &&
        !associatedTenantIds.includes(m.tenantId) &&
        !associatedTenantIds.includes(m.senderId) &&
        !associatedTenantIds.includes(m.recipientId),
    );
    if (filteredMessages.length < messages.length) {
      (globalThis as any).__PROP_MAN_DB__.messages = filteredMessages;
    }

    // 2. Delete payments related to this property
    const payments = getCollection("payments");
    const filteredPayments = payments.filter((p: any) => p.propertyId !== id);
    if (filteredPayments.length < payments.length) {
      (globalThis as any).__PROP_MAN_DB__.payments = filteredPayments;
    }

    // 3. Delete transactions/expenses related to this property
    const transactions = getCollection("transactions");
    const filteredTransactions = transactions.filter(
      (t: any) => t.propertyId !== id,
    );
    if (filteredTransactions.length < transactions.length) {
      (globalThis as any).__PROP_MAN_DB__.transactions = filteredTransactions;
    }

    // 4. Delete maintenance requests related to this property
    const maintenance = getCollection("maintenance");
    const filteredMaintenance = maintenance.filter(
      (m: any) => m.propertyId !== id,
    );
    if (filteredMaintenance.length < maintenance.length) {
      (globalThis as any).__PROP_MAN_DB__.maintenance = filteredMaintenance;
    }

    // 5. Delete notifications for tenants in this property
    const notifications = getCollection("notifications");
    const filteredNotifications = notifications.filter(
      (n: any) => !associatedTenantIds.includes(n.tenantId),
    );
    if (filteredNotifications.length < notifications.length) {
      (globalThis as any).__PROP_MAN_DB__.notifications = filteredNotifications;
    }

    // 6. Delete replies associated with deleted messages
    const replies = getCollection("replies");
    const deletedMessageIds = messages
      .filter(
        (m: any) =>
          m.propertyId === id ||
          associatedTenantIds.includes(m.tenantId) ||
          associatedTenantIds.includes(m.senderId) ||
          associatedTenantIds.includes(m.recipientId),
      )
      .map((m: any) => m.id || m._id)
      .filter(Boolean);
    const filteredReplies = replies.filter(
      (r: any) => !deletedMessageIds.includes(r.messageId),
    );
    if (filteredReplies.length < replies.length) {
      (globalThis as any).__PROP_MAN_DB__.replies = filteredReplies;
    }

    // 7. Delete documents related to this property or its tenants
    const documents = getCollection("documents");
    const filteredDocuments = documents.filter((doc: any) => {
      if (!doc) return true;
      if (doc.ownerType === "property" && doc.ownerId === id) return false;
      if (
        doc.ownerType === "tenant" &&
        associatedTenantIds.includes(doc.ownerId)
      )
        return false;
      return true;
    });
    if (filteredDocuments.length < documents.length) {
      (globalThis as any).__PROP_MAN_DB__.documents = filteredDocuments;
    }

    // 8. Delete all tenant profiles
    const filteredTenants = allTenants.filter(
      (t) => !associatedTenantIds.includes(t.id),
    );
    if (filteredTenants.length < allTenants.length) {
      (globalThis as any).__PROP_MAN_DB__.tenants = filteredTenants;
    }

    // 9. Delete announcements related to this property
    const announcements = getCollection("announcements");
    const filteredAnnouncements = announcements.filter(
      (a: any) => a.propertyId !== id,
    );
    if (filteredAnnouncements.length < announcements.length) {
      (globalThis as any).__PROP_MAN_DB__.announcements = filteredAnnouncements;
    }

    // 10. Delete the property itself
    removeFromCollection("properties", id);

    // Update React Query cache
    queryClient.setQueryData<PropertyRecord[]>(["properties"], (current) =>
      current ? current.filter((property) => property.id !== id) : [],
    );

    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["properties"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["tenants"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["payments"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["maintenance"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["messages"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["documents"], exact: false });
    queryClient.invalidateQueries({
      queryKey: ["announcements"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["notifications"],
      exact: false,
    });
    queryClient.invalidateQueries({ queryKey: ["replies"], exact: false });

    return true;
  } catch (error) {
    console.error("Error deleting property", error);
    return false;
  }
}
