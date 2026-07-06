"use client";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import RecordPaymentModal from "@/components/modals/record-payment-modal";

import { useState, useRef, useEffect, useMemo } from "react";
import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddTenantForm from "@/components/forms/add-tenant-form";
import PropertyFormDialog from "@/components/forms/property-form-dialog";
import PropertyInviteDialog from "@/components/forms/property-invite-dialog";
import {
  createTenantApi,
  deleteTenant,
  TenantRecord,
} from "@/lib/services/tenants";
import { useAppData } from "@/lib/data-context";
import { getErrorMessage } from "@/lib/utils";
import {
  deleteProperty,
  getPropertyById,
  normalizePropertyRecord,
  updateProperty,
} from "@/lib/services/properties";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  MapPin,
  Users,
  DollarSign,
  FileText,
  Settings,
  Edit,
  Home,
  ImagePlus,
  Copy,
  Check,
  Loader2,
  Trash,
  X,
  MapPinOff,
  MoreHorizontal,
  Eye,
  Loader,
  Trash2,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { deleteMessageApi } from "@/lib/services/messages";
import {
  getSpecificationsForType,
  getCategoryForType,
  createSpecificationValues,
} from "@/lib/constants/property-types";
import { apiRequest } from "@/lib/query-client";
import { url } from "inspector";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import { set } from "react-hook-form";

interface SpecificationRow {
  title: string;
  value: string;
}

interface PropertyDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { id } = use(params);
  const { properties, tenants, payments } = useAppData();
  const activeCurrency = useActiveCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [property, setProperty] = useState<any | null>(null);
  const { token } = useAuth();

  const refreshProperty = async () => {
    const cachedProperty = properties.find(
      (item) => item.id === id || item._id === id,
    );

    if (cachedProperty) {
      setProperty(cachedProperty);
      setImages(cachedProperty?.images || []);
    }

    if (!id) {
      return cachedProperty ?? null;
    }

    try {
      const latestProperty = await getPropertyById(id, token || undefined);
      const nextProperty = normalizePropertyRecord(
        latestProperty ?? cachedProperty ?? {},
      );
      setProperty(nextProperty);
      setImages(nextProperty?.images || []);
      return nextProperty;
    } catch (error) {
      console.warn("Failed to refresh property details:", error);
      return cachedProperty ?? null;
    }
  };

  useEffect(() => {
    void refreshProperty();
  }, [id, properties, token]);

  const propertyTenants = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.propertyId === id ||
          t.propertyId === property?.id ||
          t.propertyId === property?._id,
      ),
    [tenants, id, property?.id, property?._id],
  );

  const transactions = useMemo(() => {
    if (!property) {
      return [];
    }

    const tenantIds = propertyTenants.map((t: any) => t.id);
    return payments.filter(
      (tx: any) =>
        tx.propertyId === property.id ||
        (tx.tenantId && tenantIds.includes(tx.tenantId)),
    );
  }, [property, payments, propertyTenants]);

  const initialPropertyType =
    property?.propertyType || property?.type || "apartment";
  const initialSpecificationValues = getSpecificationsForType(
    initialPropertyType,
  ).reduce(
    (acc, spec) => {
      const existingSpec = (property?.specifications || []).find(
        (item: any) => item.title === spec.label,
      );
      acc[spec.key] = existingSpec?.value ?? "";
      return acc;
    },
    {} as Record<string, string>,
  );
  const initialCustomSpecifications = (property?.specifications || []).filter(
    (item: any) =>
      !getSpecificationsForType(initialPropertyType).some(
        (spec) => spec.label === item.title,
      ),
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [images, setImages] = useState<any[]>([]);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUnitImageUploadOpen, setIsUnitImageUploadOpen] = useState(false);
  const [isUnitGalleryOpen, setIsUnitGalleryOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  useEffect(() => {
    if (isEditOpen) {
      setEditFormError(null);
    }
  }, [isEditOpen]);

  // Delete dialog state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingProperty, setIsUpdatingProperty] = useState(false);
  const [unitUploadTarget, setUnitUploadTarget] = useState<any | null>(null);
  const [unitGalleryTarget, setUnitGalleryTarget] = useState<any | null>(null);
  const [unitUploadFile, setUnitUploadFile] = useState<File | null>(null);
  const [unitUploadPreview, setUnitUploadPreview] = useState<string | null>(
    null,
  );
  const [unitUploadName, setUnitUploadName] = useState("");
  const [isUnitUploading, setIsUnitUploading] = useState(false);
  const [unitImageError, setUnitImageError] = useState("");
  const [unitImageDeletingId, setUnitImageDeletingId] = useState<string | null>(
    null,
  );
  const unitFileInputRef = useRef<HTMLInputElement | null>(null);

  // Income Calculations
  const unitRecords = useMemo(() => {
    const rawUnits = Array.isArray(property?.units)
      ? property.units
      : Array.isArray(property?.detailedUnits)
        ? property.detailedUnits
        : [];

    if (!Array.isArray(rawUnits)) {
      return [];
    }

    return rawUnits
      .filter((unit: any) => unit && typeof unit === "object")
      .map((unit: any) => ({
        unitNumber: unit.unitNumber || unit.unit || "",
        rent: Number(
          unit.rent ?? unit.price ?? unit.monthlyRent ?? unit.rentAmount ?? 0,
        ),
        images: Array.isArray(unit.images) ? unit.images : [],
        name: unit.unitType || "",
      }));
  }, [property?.units, property?.detailedUnits]);

  const totalUnits = unitRecords.length || property?.units_available || 0;
  const occupiedUnits = propertyTenants.length;

  const totalUnitRent = unitRecords.reduce(
    (sum: number, unit: any) => sum + (Number(unit.rent) || 0),
    0,
  );

  const totalMonthlyIncome = Math.max(0, totalUnitRent);
  const totalAnnualIncome = totalMonthlyIncome * 12;

  const occupiedUnitNumbers = new Set(
    propertyTenants
      .map((tenant: any) => String(tenant?.unitNumber ?? "").trim())
      .filter(Boolean),
  );

  const vacantUnitRecords = unitRecords.filter((unit: any) => {
    const unitNumber = String(unit?.unitNumber ?? "").trim();
    return unitNumber ? !occupiedUnitNumbers.has(unitNumber) : true;
  });

  const vacantUnitRent = vacantUnitRecords.reduce(
    (sum: number, unit: any) => sum + (Number(unit.rent) || 0),
    0,
  );

  const availableUnits = vacantUnitRecords.length;
  const monthlyRevenueLoss = Math.max(0, vacantUnitRent);
  const annualRevenueLoss = monthlyRevenueLoss * 12;

  const updateUnitImages = (unitNumber: string, nextImages: any[]) => {
    const updatedUnits = (property?.detailedUnits || property?.units || []).map(
      (unit: any) => {
        const currentUnitNumber = unit.unitNumber || unit.unit || "";
        if (currentUnitNumber !== unitNumber) return unit;
        return { ...unit, images: nextImages };
      },
    );

    setProperty((prev: any) => ({ ...prev, units: updatedUnits }));
    setProperty((prev: any) => ({ ...prev, detailedUnits: updatedUnits }));
  };

  const openUnitUploadDialog = (unit: any) => {
    setUnitUploadTarget(unit);
    setUnitUploadName("");
    setUnitUploadFile(null);
    setUnitUploadPreview(null);
    setUnitImageError("");
    setIsUnitImageUploadOpen(true);
  };

  const openUnitGalleryDialog = (unit: any) => {
    setUnitGalleryTarget(unit);
    setUnitImageError("");
    setIsUnitGalleryOpen(true);
  };

  const handleUnitImageUpload = async () => {
    if (!unitUploadTarget || !unitUploadFile) {
      setUnitImageError("Please select an image to upload.");
      return;
    }

    const existingImages = Array.isArray(unitUploadTarget?.images)
      ? unitUploadTarget.images
      : [];
    if (existingImages.length >= 5) {
      setUnitImageError("Each unit can have a maximum of 5 images.");
      return;
    }

    setIsUnitUploading(true);
    setUnitImageError("");
    try {
      const res = await uploadToCloudinary(unitUploadFile);
      if (!res?.secure_url || !res?.public_id) {
        throw new Error("Cloudinary upload did not return a valid URL");
      }

      const nextImages = [
        ...existingImages,
        {
          name:
            unitUploadName.trim() ||
            unitUploadTarget.unitNumber ||
            "unit-image",
          url: res.secure_url,
          public_id: res.public_id,
        },
      ];

      const response = await apiRequest(
        "POST",
        `/property/${property?.id}/unit/${encodeURIComponent(unitUploadTarget.unitNumber)}/images`,
        {
          images: nextImages,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save unit image");
      }

      const payload = await response.json();
      const updatedUnit = payload?.unit || null;
      if (updatedUnit) {
        updateUnitImages(
          updatedUnit.unitNumber || unitUploadTarget.unitNumber,
          updatedUnit.images || nextImages,
        );
      }
      refreshProperty();
      setIsUnitImageUploadOpen(false);
    } catch (error: any) {
      console.error("Unit image upload failed", error);
      setUnitImageError(
        error?.message || "Failed to upload unit image. Please try again.",
      );
    } finally {
      setIsUnitUploading(false);
      setUnitUploadFile(null);
      setUnitUploadPreview(null);
      setUnitUploadName("");
    }
  };

  const handleUnitImageDelete = async (unit: any, image: any) => {
    if (!image?.public_id) {
      return;
    }

    setUnitImageDeletingId(image.public_id);
    try {
      const response = await apiRequest(
        "DELETE",
        `/property/${property?.id}/unit/${encodeURIComponent(unit.unitNumber)}/images/${encodeURIComponent(image.public_id)}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete unit image");
      }

      const nextImages = (Array.isArray(unit.images) ? unit.images : []).filter(
        (item: any) => item.public_id !== image.public_id,
      );
      updateUnitImages(unit.unitNumber, nextImages);
      refreshProperty();
    } catch (error: any) {
      console.error("Unit image delete failed", error);
    } finally {
      setUnitImageDeletingId(null);
    }
  };
  const averageIncomePerUnit =
    totalUnits > 0 ? Math.round(totalMonthlyIncome / totalUnits) : 0;
  const potentialMonthlyIncome = totalMonthlyIncome;
  const occupancyPercentage =
    totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const incomeUtilization =
    potentialMonthlyIncome > 0
      ? Math.round((totalMonthlyIncome / potentialMonthlyIncome) * 100)
      : 0;

  const revenueLost = monthlyRevenueLoss;
  const avgRevenueLostPerUnit = availableUnits
    ? Math.round(revenueLost / availableUnits)
    : 0;

  if (!mounted || !property) {
    return (
      <div className="space-y-6">
        <div className="flex pb-2 items-center justify-center gap-4">
          <Button variant="outline" asChild>
            <Link
              href="/dashboard/properties"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
        </div>
        <Card className="border border-border p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <img
              src="/no-property.png"
              alt="Property not found"
              className="mx-auto mb-4 w-32 h-32"
            />
            <p className="text-muted-foreground mb-5">Property not found</p>
          </div>
        </Card>
      </div>
    );
  }

  const hundlePropertyDelete = async (id: any) => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      const success = await deleteProperty(
        id,
        adminPassword,
        token ? token : "",
      );
      if (!success) {
        setDeleteError(
          "Unable to delete the property. Please verify the admin password and try again.",
        );
        return;
      }
      setIsDeleteOpen(false);
      window.location.href = "/dashboard/properties";
    } catch (error) {
      console.log(error);
      setDeleteError(
        "An unexpected error occurred while deleting the property.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              This will permanently delete the property and all associated
              tenant profiles. Please enter the admin password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              type="password"
              placeholder="Admin Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={isDeleting}
            />
            {deleteError && (
              <div className="text-red-600 text-sm">{deleteError}</div>
            )}
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting || !adminPassword}
                onClick={() => hundlePropertyDelete(property.id)}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {property ? (
        <div>
          {/* Header */}
          <div className="flex pb-2 items-center justify-center gap-4">
            <Button variant="outline" asChild>
              <Link
                href="/dashboard/properties"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <span className="flex-1 w-full"></span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Property
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => setIsDeleteOpen(true)}
            >
              <Trash className="w-4 h-4 mr-2" />
              Delete Property
            </Button>

            <PropertyFormDialog
              mode="edit"
              isOpen={isEditOpen}
              onClose={() => setIsEditOpen(false)}
              initialData={property}
              onSubmit={async (data: any) => {
                try {
                  setIsUpdatingProperty(true);
                  const updated: any = {};

                  if (data.name !== "") updated.name = data.name;
                  if (data.address !== "") updated.address = data.address;
                  if (data.city !== "") updated.city = data.city;
                  if (data.country !== "") updated.country = data.country;
                  if (data.estate !== "") updated.estate = data.estate;
                  updated.price_per_unit = data.pricePerUnit;
                  updated.units_available = data.units;
                  if (data.category !== "") updated.category = data.category;
                  if (data.propertyType !== "")
                    updated.propertyType = data.propertyType;
                  if (data.geography !== "") updated.geography = data.geography;

                  const cleanedFeatures = data.features
                    .split("\n")
                    .map((s: string) => s.trim())
                    .filter(Boolean);
                  if (cleanedFeatures.length > 0) {
                    updated.features = cleanedFeatures;
                  }

                  if (data.location.lat !== "" && data.location.lng !== "") {
                    updated.location = {
                      lat: Number(data.location.lat),
                      lng: Number(data.location.lng),
                    };
                  }

                  const dynamicSpecifications = Object.entries(
                    data.specificationValues || {},
                  ).flatMap(([key, value]) => {
                    const label = getSpecificationsForType(
                      data.propertyType,
                    ).find((spec) => spec.key === key)?.label;
                    const trimmed = value?.toString().trim();
                    return trimmed && label
                      ? [{ title: label, value: trimmed }]
                      : [];
                  });

                  const customSpecifications = (
                    data.customSpecifications || []
                  ).filter(
                    (spec: any) =>
                      spec.title?.trim() !== "" || spec.value?.trim() !== "",
                  );

                  const specifications = [
                    ...dynamicSpecifications,
                    ...customSpecifications,
                  ];

                  if (specifications.length > 0) {
                    updated.specifications = specifications;
                  }

                  if (data.customizeUnits !== undefined) {
                    updated.customizeUnits = data.customizeUnits;
                    updated.autoGenerateUnitNumbers =
                      data.autoGenerateUnitNumbers;
                    updated.customUnitNumbers = data.customUnitNumbers;
                    updated.detailedUnits = data.detailedUnits;
                  }

                  if (data.zoning !== "") updated.zoning = data.zoning;
                  if (data.permittedUses !== "") {
                    const cleanedPermittedUses = data.permittedUses
                      .split("\n")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                    if (cleanedPermittedUses.length > 0) {
                      updated.permittedUses = cleanedPermittedUses;
                    }
                  }
                  if (data.annualPropertyTaxes !== "")
                    updated.annualPropertyTaxes = Number(
                      data.annualPropertyTaxes,
                    );
                  if (data.annualInsurance !== "")
                    updated.annualInsurance = Number(data.annualInsurance);
                  if (data.appraisedValue !== "")
                    updated.appraisedValue = Number(data.appraisedValue);
                  if (data.lastAppraisalDate !== "")
                    updated.lastAppraisalDate = data.lastAppraisalDate;
                  if (data.noi !== "") updated.noi = Number(data.noi);
                  if (data.capRate !== "")
                    updated.capRate = Number(data.capRate);
                  if (data.description !== "")
                    updated.description = data.description;
                  if (data.imageUrl !== "") updated.images = [data.imageUrl];

                  if (typeof data.serviceFee !== "undefined") {
                    updated.serviceFee = Number(data.serviceFee) || 0;
                  }

                  // Include policies if provided
                  if (data.policies) {
                    updated.policies = {
                      petPolicy: {
                        allowed: Boolean(data.policies.petPolicy?.allowed),
                        details: data.policies.petPolicy?.details || "",
                      },
                      parkingPolicy: {
                        allowed: Boolean(data.policies.parkingPolicy?.allowed),
                        details: data.policies.parkingPolicy?.details || "",
                      },
                      leasePolicy: data.policies.leasePolicy || "",
                      otherPolicies: (data.policies.otherPolicies || [])
                        .map((p: any) => ({
                          title: p.title?.trim() || "",
                          body: p.body?.trim() || "",
                        }))
                        .filter((p: any) => p.title || p.body),
                    };
                  }

                  await updateProperty(property?.id, updated);
                  refreshProperty();
                  setIsEditOpen(false);
                } catch (e) {
                  const errorMessage = getErrorMessage(
                    e,
                    "Failed to update property",
                  );
                  setEditFormError(errorMessage);
                  console.error("Failed to update property", errorMessage);
                } finally {
                  setIsUpdatingProperty(false);
                }
              }}
              isLoading={isUpdatingProperty}
              errorMessage={editFormError}
            />
          </div>

          {/* Property Hero */}
          <Card className="border border-border overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              {/* Image Gallery */}
              <div className="md:col-span-1 space-y-3">
                {/* Main Image */}
                <div className="relative h-64 bg-secondary overflow-hidden rounded-lg">
                  <img
                    src={
                      images?.[selectedImageIndex]?.url || "/placeholder.svg"
                    }
                    alt={property?.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Thumbnail Images */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images &&
                    images.length > 0 &&
                    images.map((image: any, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <button
                          onClick={() => setSelectedImageIndex(index)}
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageIndex === index
                              ? "border-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <img
                            src={image?.url}
                            alt={`${property?.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete image ${index + 1}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const next = images.filter((_, i) => i !== index);
                            setImages(next);
                            try {
                              const res = await apiRequest(
                                "POST",
                                `/property/${property?.id}/delete-image`,
                                { public_id: image.public_id },
                              );

                              if (!res.ok) {
                                throw new Error(
                                  `Failed to delete image: ${await res.text()}`,
                                );
                                return;
                              }
                              await updateProperty(property?.id, {
                                images: next.map((u: any) =>
                                  typeof u === "string"
                                    ? { url: u, public_id: "" }
                                    : u,
                                ),
                              });
                              refreshProperty();
                            } catch (err) {
                              console.error(
                                "Failed to persist image deletion",
                                err,
                              );
                            }
                            setSelectedImageIndex((prev) =>
                              Math.max(0, Math.min(prev, next.length - 1)),
                            );
                          }}
                          className="absolute top-0 right-0 m-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/90 hover:bg-red-600 hover:text-white text-xs"
                        >
                          <X className="w-3 font-bold h-3" />
                        </button>
                      </div>
                    ))}

                  {/* Small add button always visible when under limit */}
                  {images.length < 6 && (
                    <div>
                      <Button
                        size="sm"
                        onClick={() => setIsUploadOpen(true)}
                        className="bg-transparent w-16 h-16 border-dashed border-2 border-border hover:border-white hover:text-primary hover:bg-primary p-3"
                      >
                        <ImagePlus className="w-5 h-5 text-gray-200" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Image Upload Dialog */}
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Property Image</DialogTitle>
                      <DialogDescription>
                        Add a title and upload an image for this property
                        gallery.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Title
                        </label>
                        <Input
                          name="uploadTitle"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder="Image title (optional)"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Image
                        </label>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (!f) {
                              setUploadFile(null);
                              setUploadPreview(null);
                              return;
                            }
                            setUploadFile(f);
                            const url = URL.createObjectURL(f);
                            setUploadPreview(url);
                          }}
                          className="hidden"
                        />

                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            const f = e.dataTransfer.files?.[0] ?? null;
                            if (!f) return;
                            setUploadFile(f);
                            const url = URL.createObjectURL(f);
                            setUploadPreview(url);
                          }}
                          className={`flex items-center justify-center flex-col gap-2 rounded-md border-2 p-6 text-center cursor-pointer ${
                            dragActive
                              ? "border-primary bg-primary/5"
                              : "border-dashed border-border bg-transparent"
                          }`}
                        >
                          <ImagePlus className="w-8 h-8 text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">
                            <div>
                              Drag & drop an image here, or click to browse
                            </div>
                            <div className="text-xs text-muted-foreground/80">
                              PNG, JPG, GIF up to 10MB
                            </div>
                          </div>
                        </div>

                        {uploadPreview && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-foreground mb-2">
                              Preview
                            </p>
                            <img
                              src={uploadPreview}
                              alt="Upload preview"
                              className="max-h-40 w-auto rounded border"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <DialogFooter>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            // cancel
                            if (uploadPreview) {
                              URL.revokeObjectURL(uploadPreview);
                            }
                            setUploadFile(null);
                            setUploadPreview(null);
                            setUploadTitle("");
                            setIsUploadOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={isUploading}
                          onClick={async () => {
                            setIsUploading(true);
                            try {
                              if (uploadFile) {
                                const res =
                                  await uploadToCloudinary(uploadFile);
                                const next = [
                                  ...images,
                                  {
                                    url: res.secure_url,
                                    public_id: res.public_id,
                                  },
                                ];
                                setImages(next);
                                setSelectedImageIndex(next.length - 1);

                                try {
                                  const resp = await apiRequest(
                                    "POST",
                                    `/property/${property?.id}/add-image`,
                                    {
                                      url: res.secure_url,
                                      public_id: res.public_id,
                                    },
                                  );

                                  if (!resp.ok) {
                                    console.error(
                                      "Failed to persist property image",
                                      await resp.text(),
                                    );
                                    return;
                                  }
                                  await updateProperty(property?.id, {
                                    images: next.map((u: any) =>
                                      typeof u === "string"
                                        ? { url: u, public_id: "" }
                                        : u,
                                    ),
                                  });
                                  refreshProperty();
                                } catch (e) {
                                  console.error(
                                    "Failed to persist property images",
                                    e,
                                  );
                                }

                                console.log("Cloudinary upload result", res);
                              } else if (uploadPreview) {
                                setImages((prev) => {
                                  const next = [...prev, uploadPreview];
                                  setSelectedImageIndex(next.length - 1);
                                  return next;
                                });
                              }
                            } catch (err) {
                              console.error("Upload failed", err);
                            } finally {
                              setIsUploading(false);
                              if (uploadPreview)
                                URL.revokeObjectURL(uploadPreview);
                              setUploadFile(null);
                              setUploadPreview(null);
                              setUploadTitle("");
                              setIsUploadOpen(false);
                            }
                          }}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            "Add Image"
                          )}
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Info */}
              <div className="md:col-span-2">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {property?.name}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {property?.address}, {property?.city}, {property?.country}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    Property ID:
                    <span className="underline">{property?.id}</span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(String(property?.id));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch (e) {
                          // ignore
                        }
                      }}
                      aria-label="Copy property id"
                      className="ml-1 p-1 rounded hover:bg-secondary"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 cursor-pointer" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="inline-block px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-semibold">
                      Active Property
                    </div>
                    <div className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold capitalize">
                      {property?.propertyType || property?.type || "N/A"}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 items-center">
                    <PropertyInviteDialog
                      property={property}
                      token={token || ""}
                    />
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Financial Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Monthly Income
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalMonthlyIncome, activeCurrency)}
                      </p>
                    </Card>
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Annual Income
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalAnnualIncome, activeCurrency)}
                      </p>
                    </Card>
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Occupied Units
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {occupiedUnits}/{totalUnits}
                      </p>
                    </Card>
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Occupancy Rate
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {occupancyPercentage}%
                      </p>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Dialog
            open={isUnitImageUploadOpen}
            onOpenChange={setIsUnitImageUploadOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload unit image</DialogTitle>
                <DialogDescription>
                  Add up to 5 images for{" "}
                  {unitUploadTarget?.unitNumber || "this unit"}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Image name
                  </label>
                  <Input
                    value={unitUploadName}
                    onChange={(e) => setUnitUploadName(e.target.value)}
                    placeholder="Kitchen, bathroom, etc."
                  />
                </div>
                <div>
                  <input
                    ref={unitFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setUnitUploadFile(file);
                      if (file) {
                        setUnitUploadPreview(URL.createObjectURL(file));
                      } else {
                        setUnitUploadPreview(null);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => unitFileInputRef.current?.click()}
                    className="flex h-32 w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground"
                  >
                    {unitUploadPreview ? "Change image" : "Choose image"}
                  </button>
                  {unitUploadPreview && (
                    <img
                      src={unitUploadPreview}
                      alt="Unit preview"
                      className="mt-3 h-40 w-full rounded-md object-cover"
                    />
                  )}
                </div>
                {unitImageError ? (
                  <p className="text-sm text-red-600">{unitImageError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUnitImageUploadOpen(false);
                    setUnitUploadFile(null);
                    setUnitUploadPreview(null);
                    setUnitUploadName("");
                    setUnitImageError("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={isUnitUploading}
                  onClick={handleUnitImageUpload}
                >
                  {isUnitUploading ? "Uploading..." : "Upload image"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isUnitGalleryOpen} onOpenChange={setIsUnitGalleryOpen}>
            <DialogContent className="max-w-2xl overflow-auto">
              <DialogHeader>
                <DialogTitle>
                  {unitGalleryTarget?.unitNumber || "Unit gallery"}
                </DialogTitle>
                <DialogDescription>
                  Browse images for this unit. You can delete any image you no
                  longer need.
                </DialogDescription>
              </DialogHeader>
              <div
                className={
                  Array.isArray(unitGalleryTarget?.images) &&
                  unitGalleryTarget.images.length === 1
                    ? "grid gap-4 grid-cols-1"
                    : "grid gap-4 md:grid-cols-2"
                }
              >
                {Array.isArray(unitGalleryTarget?.images) &&
                unitGalleryTarget.images.length > 0 ? (
                  unitGalleryTarget.images.map((image: any, index: number) => (
                    <div
                      key={`${image.public_id || index}`}
                      className={`rounded-md relative overflow-hidden w-full max-w-full h-92 ${
                        Array.isArray(unitGalleryTarget?.images) &&
                        unitGalleryTarget.images.length === 1
                          ? " col-span-full md:h-96"
                          : ""
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.name || `Unit image ${index + 1}`}
                        className="h-full w-full rounded-md object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 rounded-b-md bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 py-3" />

                      <p className="text-sm absolute bottom-1 left-3 font-medium text-white drop-shadow-sm">
                        {image.name || `Image ${index + 1}`}
                      </p>
                      <Button
                        variant="ghost"
                        className="absolute text-red-500 hover:bg-transparent top-1 right-1"
                        size="sm"
                        disabled={unitImageDeletingId === image.public_id}
                        onClick={() => {
                          handleUnitImageDelete(unitGalleryTarget, image);
                          setUnitGalleryTarget((prev: any) => ({
                            ...prev,
                            images: prev?.images.filter(
                              (img: any) => img.public_id !== image.public_id,
                            ),
                          }));
                        }}
                      >
                        {unitImageDeletingId === image.public_id ? (
                          <>
                            <Loader className="animate-spin" />
                          </>
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No images yet for this unit.
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Tabs */}
          <Card className="border border-border">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="border-b border-border rounded-none p-0 h-auto bg-transparent">
                <TabsTrigger
                  value="overview"
                  className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="units"
                  className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Units
                </TabsTrigger>
                <TabsTrigger
                  value="tenants"
                  className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Tenants
                </TabsTrigger>
                <TabsTrigger
                  value="financials"
                  className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Financials
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Documents
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Property Information
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Property Type
                      </p>
                      <p className="font-semibold text-foreground capitalize">
                        {property?.propertyType || (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Available Units
                      </p>
                      <p className="font-semibold text-foreground">
                        {property?.units !== undefined &&
                        property?.units.length > 0 ? (
                          availableUnits
                        ) : (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Address
                      </p>
                      <p className="font-semibold text-foreground">
                        {property?.address || (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">City</p>
                      <p className="font-semibold text-foreground">
                        {property?.city || (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Country
                      </p>
                      <p className="font-semibold text-foreground">
                        {property?.country || (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Square Meters
                      </p>
                      <p className="font-semibold text-foreground">
                        {property?.sq_mtrs !== undefined &&
                        property?.sq_mtrs !== null ? (
                          property?.sq_mtrs
                        ) : (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Features & Details
                  </h3>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Geography
                      </p>
                      <p className="font-semibold text-foreground">
                        {property?.geography || (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Occupancy Status
                      </p>
                      <p className="font-semibold text-foreground">
                        {`${occupancyPercentage}% Occupied` || (
                          <span className="text-muted-foreground">
                            No details found
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Property Features
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(property?.features) &&
                      property?.features.length > 0 ? (
                        property?.features.map(
                          (feature: any, index: number) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-semibold rounded-full"
                            >
                              {feature}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-muted-foreground">
                          No details found
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Property Specifications */}
                {property?.specifications &&
                  property.specifications.length > 0 && (
                    <div className="border-t border-border pt-6">
                      <h3 className="text-lg font-bold text-foreground mb-4">
                        Property Specifications
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {property.specifications
                          .filter(
                            (spec: any) =>
                              spec.title?.trim() && spec.value?.trim(),
                          )
                          .map((spec: any, index: number) => (
                            <div key={index} className="flex flex-col">
                              <p className="text-sm text-muted-foreground mb-1">
                                {spec.title}
                              </p>
                              <p className="font-semibold text-foreground">
                                {spec.value}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                <div className="border-t border-border pt-6">
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Rental Details
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Price Per Unit
                      </p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(
                          property?.price_per_unit,
                          activeCurrency,
                        )}
                      </p>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Tenants
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {propertyTenants.length}
                      </p>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Occupancy
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {property?.tenants?.length} Units Occupied
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Units Tab */}
              <TabsContent value="units" className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">
                      Unit Inventory ({unitRecords.length})
                    </h3>
                  </div>
                  {unitRecords.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Unit Type
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Unit
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Rent
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right font-semibold text-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {unitRecords.map((unit: any, index: number) => {
                            const occupied = propertyTenants.some(
                              (tenant) => tenant.unitNumber === unit.unitNumber,
                            );
                            // console.log("Unit occupancy check", unit);
                            return (
                              <tr
                                key={`${unit.unitNumber}-${index}`}
                                className="border-b border-border hover:bg-secondary"
                              >
                                <td className="px-4 py-3 font-semibold text-foreground">
                                  {unit.name || "N/A"}
                                </td>
                                <td className="px-4 py-3 font-semibold text-foreground">
                                  {unit.unitNumber}
                                </td>
                                <td className="px-4 py-3 text-foreground">
                                  {formatCurrency(
                                    unit.rent ?? 0,
                                    activeCurrency,
                                  )}
                                </td>
                                <td className="px-4 py-3 text-foreground">
                                  {occupied ? "Occupied" : "Available"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openUnitUploadDialog(unit)}
                                    >
                                      <ImagePlus className="mr-2 h-4 w-4" />
                                      Upload
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        openUnitGalleryDialog(unit)
                                      }
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      Gallery ({unit.images?.length || 0})
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Card className="border border-border p-8 text-center">
                      <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">
                        No units available for this property
                      </p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Tenants Tab */}
              <TabsContent value="tenants" className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">
                      Tenants ({propertyTenants.length})
                    </h3>
                    <AddTenantForm
                      isOpen={showAddTenant}
                      onClose={() => setShowAddTenant(false)}
                      onSubmit={async (data: any) => {
                        try {
                          const payload: Partial<TenantRecord> = {
                            name: data.name,
                            email: data.email,
                            preferredName: data.preferredName,
                            middleName: data.middleName,
                            gender: data.gender,
                            maritalStatus: data.maritalStatus,
                            nationality: data.nationality,
                            placeOfOrigin: data.placeOfOrigin,
                            hasFamily: data.hasFamily === "yes",
                            householdMembers: data.householdMembers
                              ? data.householdMembers
                                  .split("\n")
                                  .filter(Boolean)
                              : undefined,
                            cohabitant: {
                              name: data.cohabitantName,
                              relationship: data.cohabitantRelationship,
                            },
                            occupation: data.occupation,
                            employerName: data.employerName,
                            position: data.position,
                            nextOfKin: {
                              name: data.nextOfKinName,
                              relationship: data.nextOfKinRelationship,
                              phone: data.nextOfKinPhone,
                              email: data.nextOfKinEmail,
                            },
                            tenantType: data.tenantType,
                            unitNumber: data.unitNumber,
                            propertyId: property?.id,
                            rentAmount: data.monthlyRent,
                            leaseType: data.leaseType,
                            leaseStartDate: data.leaseStartDate,
                            leaseEndDate: data.leaseEndDate,
                            leaseTerms: data.leaseTerms,
                            preferredContactMethod: data.preferredContactMethod,
                            applicationDate: data.applicationDate,
                            moveInDate: data.moveInDate,
                            dateOfBirth: data.dateOfBirth,
                            employmentInfo: data.employmentInfo,
                            previousAddresses: data.previousAddresses
                              ? data.previousAddresses
                                  .split("\n")
                                  .filter(Boolean)
                              : undefined,
                            coSigner: data.coSigner,
                            pets: data.pets,
                            vehicles: data.vehicles,
                            businessInfo: data.businessInfo,
                            businessContacts: data.businessContacts,
                            financialInfo: data.financialInfo,
                            securityDeposit: data.securityDeposit,
                            status: "due",
                          };

                          await createTenantApi(payload);
                          refreshProperty();
                          setShowAddTenant(false);
                        } catch (e) {
                          console.error("Add tenant failed", e);
                        }
                      }}
                    />
                    <Button size="sm" onClick={() => setShowAddTenant(true)}>
                      Add Tenant
                    </Button>
                  </div>
                  {propertyTenants.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Unit
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Avatar
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Tenant
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Monthly Rent
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Lease Type
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {propertyTenants.map((tenant) => (
                            <tr
                              key={tenant.id}
                              className="border-b border-border hover:bg-secondary"
                            >
                              <td className="px-4 py-3 font-semibold text-foreground">
                                {tenant.unitNumber}
                              </td>
                              <td className="px-4 py-3">
                                <Image
                                  src={
                                    tenant?.avatar?.url ||
                                    "https://img.freepik.com/free-vector/blue-circle-with-white-user_78370-4707.jpg?semt=ais_hybrid&w=740&q=80"
                                  }
                                  alt={tenant?.name || "Tenant"}
                                  width={40}
                                  height={40}
                                  className="rounded-full object-cover"
                                />
                              </td>
                              <td className="px-4 py-3 text-foreground">
                                <Link
                                  href={`/dashboard/tenants/${tenant.id}`}
                                  className="font-semibold text-blue-600 hover:underline"
                                >
                                  {tenant.name}
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-semibold text-foreground">
                                {formatCurrency(
                                  tenant.rentAmount,
                                  activeCurrency,
                                  undefined,
                                  { convert: false },
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    tenant.status === "paid"
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                      : tenant.status === "due"
                                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                        : tenant.status === "moving out"
                                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                  }`}
                                >
                                  {tenant.status === "paid"
                                    ? "Paid"
                                    : tenant.status === "due"
                                      ? "Due"
                                      : (tenant.status ?? "").replace("-", " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-foreground capitalize">
                                {tenant.leaseType}
                              </td>
                              <td className="px-4 py-3">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-border bg-transparent"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/dashboard/tenants/${tenant.id}`}
                                        className="flex items-center"
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setShowRecordPayment(true);
                                        setSelectedTenant(tenant);
                                      }}
                                    >
                                      <DollarSign className="mr-2 h-4 w-4" />
                                      Record Payment
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Card className="border border-border p-8 text-center">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-4">
                        No tenants in this property
                      </p>
                      <Button size="sm">Add First Tenant</Button>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Financials Tab */}
              <TabsContent value="financials" className="p-6">
                {/* Income Summary */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Income Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Monthly Income
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalMonthlyIncome, activeCurrency)}
                      </p>
                    </Card>
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Annual Income
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalAnnualIncome, activeCurrency)}
                      </p>
                    </Card>
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Occupied Units
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {occupiedUnits}/{totalUnits}
                      </p>
                    </Card>
                    <Card className="border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Occupancy Rate
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {occupancyPercentage}%
                      </p>
                    </Card>
                  </div>
                </div>

                {/* Revenue Loss Summary */}
                <div className="mb-8 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900">
                  <h3 className="text-lg font-bold text-orange-900 dark:text-orange-400 mb-4">
                    Potential Revenue Not Generated
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="border border-orange-200 dark:border-orange-900 bg-white dark:bg-card p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Monthly Revenue Loss
                      </p>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {formatCurrency(revenueLost, activeCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        From {availableUnits} vacant unit
                        {availableUnits !== 1 ? "s" : ""}
                      </p>
                    </Card>
                    <Card className="border border-orange-200 dark:border-orange-900 bg-white dark:bg-card p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Annual Revenue Loss
                      </p>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {formatCurrency(revenueLost * 12, activeCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Potential yearly loss
                      </p>
                    </Card>
                    <Card className="border border-orange-200 dark:border-orange-900 bg-white dark:bg-card p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Potential Monthly Revenue
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(potentialMonthlyIncome, activeCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        If all units occupied
                      </p>
                    </Card>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card className="border border-border p-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Price per Unit
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(
                        property?.price_per_unit ?? 0,
                        activeCurrency,
                      )}
                    </p>
                  </Card>
                  <Card className="border border-border p-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Average Income per Unit
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(averageIncomePerUnit, activeCurrency)}
                    </p>
                  </Card>
                  <Card className="border border-border p-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Total Units Available
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {availableUnits}
                    </p>
                  </Card>
                </div>

                {/* Tenant Monthly Rent Breakdown */}
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Tenant Monthly Rent Breakdown
                  </h3>
                  {propertyTenants.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Unit
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Tenant
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Monthly Rent
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Annual Income
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">
                              Lease Type
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {propertyTenants.map((tenant) => (
                            <tr
                              key={tenant.id}
                              className="border-b border-border hover:bg-secondary"
                            >
                              <td className="px-4 py-3 font-semibold text-foreground">
                                {tenant.unitNumber}
                              </td>
                              <td className="px-4 py-3 text-foreground">
                                {tenant.name}
                              </td>
                              {(() => {
                                const rent = Number(tenant.rentAmount ?? 0);
                                const serviceFee = Number(
                                  property?.serviceFee ?? 0,
                                );
                                const total = rent + serviceFee;
                                return (
                                  <>
                                    <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                                      <div className="text-sm text-muted-foreground">
                                        {formatCurrency(rent, activeCurrency)}{" "}
                                        rent ·{" "}
                                        {formatCurrency(
                                          serviceFee,
                                          activeCurrency,
                                        )}{" "}
                                        service
                                      </div>
                                      <div className="font-semibold text-green-600">
                                        {formatCurrency(total, activeCurrency)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-foreground">
                                      {formatCurrency(
                                        total * 12,
                                        activeCurrency,
                                      )}
                                    </td>
                                  </>
                                );
                              })()}
                              <td className="px-4 py-3 text-foreground capitalize">
                                {tenant.leaseType}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-border bg-secondary">
                            <td
                              colSpan={2}
                              className="px-4 py-3 font-bold text-foreground"
                            >
                              TOTAL
                            </td>
                            <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(
                                totalMonthlyIncome,
                                activeCurrency,
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(
                                totalAnnualIncome,
                                activeCurrency,
                              )}
                            </td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Card className="border border-border p-8 text-center">
                      <p className="text-muted-foreground">
                        No tenants to display
                      </p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="p-6">
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    No documents uploaded yet
                  </p>
                  <p className="text-muted-foreground mb-4">
                    (feature coming soon...)
                  </p>
                  <Button className="disabled:opacity-50" disabled={true}>
                    Upload Document
                  </Button>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="p-6">
                <div className="space-y-6 text-center">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-4">
                      Property Settings
                    </h3>
                    <p className="text-muted-foreground">
                      Manage your property details and preferences.
                    </p>
                    <p className="text-muted-foreground">
                      (feature coming soon...)
                    </p>
                    {/* <Button variant="outline">Edit Property Details</Button> */}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <MapPinOff className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            Property not found. It may have been deleted or you may not have
            access to it.
          </p>
          {/* <Button onClick={() => router.push('/dashboard/properties')}>Back to Properties</Button>   */}
        </div>
      )}
      <RecordPaymentModal
        open={showRecordPayment}
        onOpenChange={(v) => {
          setShowRecordPayment(v);
          if (!v) setSelectedTenant(null);
        }}
        tenantId={selectedTenant?.id}
        propertyId={property?.id}
      />
    </div>
  );
}
