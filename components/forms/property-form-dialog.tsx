"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  X,
  MapPin,
  Home,
  DollarSign,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  PROPERTY_CATEGORIES,
  getSpecificationsForType,
  PropertyCategory,
} from "@/lib/constants/property-types";

interface SpecificationRow {
  title: string;
  value: string;
}

interface UnitSpecification {
  label: string;
  value: string;
}

interface UnitImage {
  name: string;
  url: string;
  public_id: string;
}

interface PropertyUnit {
  unitNumber: string;
  rent: number;
  unitType: string;
  specifications: UnitSpecification[];
  images: UnitImage[];
}

interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  country: string;
  category: PropertyCategory;
  propertyType: string;
  geography: string;
  location: {
    lat: string;
    lng: string;
  };
  units: number;
  pricePerUnit: number;
  customizeUnits: boolean;
  autoGenerateUnitNumbers: boolean;
  customUnitNumbers: string;
  detailedUnits: PropertyUnit[];
  features: string;
  specificationValues: Record<string, string>;
  customSpecifications: SpecificationRow[];
  zoning: string;
  permittedUses: string;
  annualPropertyTaxes: string;
  annualInsurance: string;
  appraisedValue: string;
  lastAppraisalDate: string;
  noi: string;
  capRate: string;
  imageUrl?: string;
  description: string;
  estate: string;
  price_per_unit?: number;
  policies?: {
    petPolicy?: { allowed?: boolean; details?: string };
    parkingPolicy?: { allowed?: boolean; details?: string };
    leasePolicy?: string;
    otherPolicies?: { title: string; body: string }[];
  };
  serviceFee?: number;
}

interface PropertyFormDialogProps {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: PropertyFormData, file?: File | null) => void;
  isLoading?: boolean;
  initialData?: Partial<PropertyFormData>;
}

const defaultPropertyType =
  Object.keys(PROPERTY_CATEGORIES.residential.types)[0] || "apartment";

const createSpecificationValues = (
  propertyType: string,
  currentValues: Record<string, string> = {},
) => {
  return getSpecificationsForType(propertyType).reduce(
    (acc, spec) => {
      acc[spec.key] = currentValues[spec.key] ?? "";
      return acc;
    },
    {} as Record<string, string>,
  );
};

const getDefaultFormData = (): PropertyFormData => ({
  name: "",
  address: "",
  city: "",
  country: "",
  category: "residential",
  propertyType: defaultPropertyType,
  geography: "",
  location: { lat: "", lng: "" },
  units: 1,
  pricePerUnit: 0,
  customizeUnits: false,
  autoGenerateUnitNumbers: true,
  customUnitNumbers: "",
  detailedUnits: [],
  price_per_unit: 0,
  features: "",
  specificationValues: createSpecificationValues(defaultPropertyType),
  customSpecifications: [],
  zoning: "",
  permittedUses: "",
  annualPropertyTaxes: "",
  annualInsurance: "",
  appraisedValue: "",
  lastAppraisalDate: "",
  noi: "",
  capRate: "",
  imageUrl: "",
  description: "",
  estate: "",
  policies: {
    petPolicy: { allowed: false, details: "" },
    parkingPolicy: { allowed: false, details: "" },
    leasePolicy: "",
    otherPolicies: [],
  },
  serviceFee: 0,
});

export default function PropertyFormDialog({
  mode,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialData,
}: PropertyFormDialogProps) {
  const [formData, setFormData] =
    useState<PropertyFormData>(getDefaultFormData());
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAdvancedSection, setShowAdvancedSection] = useState(false);

  // Initialize form data based on mode and initialData
  useEffect(() => {
    if (mode === "create") {
      setFormData(getDefaultFormData());
      setSelectedImage(null);
      setShowAdvancedSection(false);
    } else if (mode === "edit" && initialData) {
      const initialFormData: PropertyFormData = {
        name: initialData.name ?? "",
        address: initialData.address ?? "",
        city: initialData.city ?? "",
        country: initialData.country ?? "",
        category: (initialData.category as PropertyCategory) ?? "residential",
        propertyType: initialData.propertyType ?? defaultPropertyType,
        geography: initialData.geography ?? "",
        location: {
          lat: initialData.location?.lat?.toString() ?? "",
          lng: initialData.location?.lng?.toString() ?? "",
        },
        units:
          (initialData as any).units_available ??
          (Array.isArray((initialData as any).units)
            ? (initialData as any).units.length
            : 0) ??
          0,
        pricePerUnit: initialData.price_per_unit ?? 0,
        customizeUnits: initialData.customizeUnits ?? false,
        autoGenerateUnitNumbers: initialData.autoGenerateUnitNumbers ?? true,
        customUnitNumbers: initialData.customUnitNumbers ?? "",
        detailedUnits: Array.isArray(initialData.detailedUnits)
          ? initialData.detailedUnits
          : Array.isArray(initialData.units)
            ? (initialData.units as any).map((unit: any) =>
                typeof unit === "string"
                  ? {
                      unitNumber: unit,
                      rent: initialData.price_per_unit ?? 0,
                      unitType: "",
                      specifications: [],
                      images: [],
                    }
                  : {
                      unitNumber: unit.unitNumber || unit.unit || "",
                      rent:
                        unit.rent ??
                        unit.price ??
                        initialData.price_per_unit ??
                        0,
                      unitType: unit.unitType || unit.type || "",
                      specifications: unit.specifications || [],
                      images: Array.isArray(unit.images) ? unit.images : [],
                    },
              )
            : [],
        features: Array.isArray(initialData.features)
          ? initialData.features.join("\n")
          : (initialData.features ?? ""),
        specificationValues: initialData.specificationValues ?? {},
        customSpecifications: initialData.customSpecifications ?? [],
        zoning: initialData.zoning ?? "",
        permittedUses: Array.isArray(initialData.permittedUses)
          ? initialData.permittedUses.join("\n")
          : (initialData.permittedUses ?? ""),
        annualPropertyTaxes: initialData.annualPropertyTaxes?.toString() ?? "",
        annualInsurance: initialData.annualInsurance?.toString() ?? "",
        appraisedValue: initialData.appraisedValue?.toString() ?? "",
        lastAppraisalDate: initialData.lastAppraisalDate ?? "",
        noi: initialData.noi?.toString() ?? "",
        capRate: initialData.capRate?.toString() ?? "",
        imageUrl: Array.isArray(initialData.imageUrl)
          ? ((initialData.imageUrl as any)[0]?.url ?? "")
          : (initialData.imageUrl ?? ""),
        description: initialData.description ?? "",
        estate: initialData.estate ?? "",
      };
      // include policies if present on initialData
      initialFormData.policies =
        initialData.policies ?? initialFormData.policies;
      initialFormData.serviceFee =
        initialData.serviceFee ?? initialFormData.serviceFee;
      setFormData(initialFormData);
      setSelectedImage(null);
    }
  }, [mode, isOpen, initialData]);

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedImage]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    if (e.target.type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      if (name.includes(".")) {
        const [parent, child] = name.split(".");
        setFormData((prev: any) => ({
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: checked,
          },
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: checked }));
      }
      return;
    }

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev: any) => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value,
        },
      }));
      return;
    }

    if (name === "units" || name === "pricePerUnit") {
      setFormData((prev) => ({ ...prev, [name]: Number(value) }));
      return;
    }

    if (name === "category") {
      const nextCategory = value as PropertyCategory;
      const nextType =
        Object.keys(PROPERTY_CATEGORIES[nextCategory].types)[0] ||
        formData.propertyType;
      setFormData((prev) => ({
        ...prev,
        category: nextCategory,
        propertyType: nextType,
        specificationValues: createSpecificationValues(
          nextType,
          prev.specificationValues,
        ),
      }));
      return;
    }

    if (name === "propertyType") {
      const nextType = value;
      setFormData((prev) => ({
        ...prev,
        propertyType: nextType,
        specificationValues: createSpecificationValues(
          nextType,
          prev.specificationValues,
        ),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSpecificationValueChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      specificationValues: {
        ...prev.specificationValues,
        [key]: value,
      },
    }));
  };

  const handleCustomSpecificationChange = (
    index: number,
    field: keyof SpecificationRow,
    value: string,
  ) => {
    setFormData((prev) => {
      const nextCustom = [...prev.customSpecifications];
      nextCustom[index] = {
        ...nextCustom[index],
        [field]: value,
      };
      return {
        ...prev,
        customSpecifications: nextCustom,
      };
    });
  };

  const addCustomSpecification = () => {
    setFormData((prev) => ({
      ...prev,
      customSpecifications: [
        ...prev.customSpecifications,
        { title: "", value: "" },
      ],
    }));
  };

  const removeCustomSpecification = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customSpecifications: prev.customSpecifications.filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const addOtherPolicy = () => {
    setFormData((prev) => ({
      ...prev,
      policies: {
        ...(prev.policies || {}),
        otherPolicies: [
          ...(prev.policies?.otherPolicies || []),
          { title: "", body: "" },
        ],
      },
    }));
  };

  const removeOtherPolicy = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      policies: {
        ...(prev.policies || {}),
        otherPolicies: (prev.policies?.otherPolicies || []).filter(
          (_, i) => i !== index,
        ),
      },
    }));
  };

  const updateOtherPolicy = (
    index: number,
    field: "title" | "body",
    value: string,
  ) => {
    setFormData((prev) => {
      const next = [...(prev.policies?.otherPolicies || [])];
      next[index] = { ...next[index], [field]: value };
      return {
        ...prev,
        policies: { ...(prev.policies || {}), otherPolicies: next },
      };
    });
  };

  const toggleCustomizeUnits = () => {
    setFormData((prev) => ({
      ...prev,
      customizeUnits: !prev.customizeUnits,
    }));
  };

  const toggleAutoGenerateUnitNumbers = () => {
    setFormData((prev) => ({
      ...prev,
      autoGenerateUnitNumbers: !prev.autoGenerateUnitNumbers,
    }));
  };

  const addDetailedUnit = () => {
    setFormData((prev) => ({
      ...prev,
      detailedUnits: [
        ...prev.detailedUnits,
        {
          unitNumber: "",
          rent: 0,
          unitType: "",
          specifications: [],
          images: [],
        },
      ],
    }));
  };

  const removeDetailedUnit = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      detailedUnits: prev.detailedUnits.filter((_, i) => i !== index),
    }));
  };

  const updateDetailedUnit = (
    index: number,
    field: keyof PropertyUnit,
    value: string | number,
  ) => {
    setFormData((prev) => {
      const nextUnits = [...prev.detailedUnits];
      nextUnits[index] = {
        ...nextUnits[index],
        [field]: value,
      };
      return {
        ...prev,
        detailedUnits: nextUnits,
      };
    });
  };

  const addDetailedUnitSpecification = (unitIndex: number) => {
    setFormData((prev) => {
      const nextUnits = [...prev.detailedUnits];
      const current = nextUnits[unitIndex];
      nextUnits[unitIndex] = {
        ...current,
        specifications: [
          ...(current.specifications || []),
          { label: "", value: "" },
        ],
      };
      return { ...prev, detailedUnits: nextUnits };
    });
  };

  const removeDetailedUnitSpecification = (
    unitIndex: number,
    specIndex: number,
  ) => {
    setFormData((prev) => {
      const nextUnits = [...prev.detailedUnits];
      const current = nextUnits[unitIndex];
      nextUnits[unitIndex] = {
        ...current,
        specifications: (current.specifications || []).filter(
          (_, i) => i !== specIndex,
        ),
      };
      return { ...prev, detailedUnits: nextUnits };
    });
  };

  const updateDetailedUnitSpecification = (
    unitIndex: number,
    specIndex: number,
    field: keyof UnitSpecification,
    value: string,
  ) => {
    setFormData((prev) => {
      const nextUnits = [...prev.detailedUnits];
      const current = nextUnits[unitIndex];
      const nextSpecs = [...(current.specifications || [])];
      nextSpecs[specIndex] = {
        ...nextSpecs[specIndex],
        [field]: value,
      };
      nextUnits[unitIndex] = {
        ...current,
        specifications: nextSpecs,
      };
      return { ...prev, detailedUnits: nextUnits };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedImage(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData, mode === "create" ? selectedImage : undefined);
    // onClose();
  };

  if (!isOpen) return null;

  const typeSpecifications = getSpecificationsForType(formData.propertyType);
  const isEditMode = mode === "edit";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {isEditMode ? "Edit Property" : "Add New Property"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditMode
                  ? "Update property details and save"
                  : "Create a new rental property"}
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-primary" />
                  Property Name
                </div>
              </label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Sunset Apartments"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Street Address
                </div>
              </label>
              <Input
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  City
                </label>
                <Input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Country
                </label>
                <Input
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Country"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Estate
              </label>
              <Input
                name="estate"
                value={formData.estate}
                onChange={handleChange}
                placeholder="e.g., Riverside Estate"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(PROPERTY_CATEGORIES).map(
                    ([key, category]) => (
                      <option key={key} value={key}>
                        {category.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Property Type
                </label>
                <select
                  name="propertyType"
                  value={formData.propertyType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(
                    PROPERTY_CATEGORIES[formData.category].types,
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 border border-border rounded-lg p-4 bg-secondary">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Type-Specific Fields
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {typeSpecifications.map((spec) => (
                  <div key={spec.key}>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {spec.label}
                    </label>
                    {spec.type === "textarea" ? (
                      <Textarea
                        name={`specificationValues.${spec.key}`}
                        value={formData.specificationValues[spec.key] ?? ""}
                        onChange={(event) =>
                          handleSpecificationValueChange(
                            spec.key,
                            event.target.value,
                          )
                        }
                        placeholder={spec.placeholder}
                        className="h-24"
                      />
                    ) : (
                      <Input
                        type={spec.type === "number" ? "number" : "text"}
                        name={`specificationValues.${spec.key}`}
                        value={formData.specificationValues[spec.key] ?? ""}
                        onChange={(event) =>
                          handleSpecificationValueChange(
                            spec.key,
                            event.target.value,
                          )
                        }
                        placeholder={spec.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 border border-border rounded-lg p-4 bg-secondary">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Custom Specifications
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomSpecification}
                >
                  Add Specification
                </Button>
              </div>
              {formData.customSpecifications.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add any extra title/value specification pairs here.
                </p>
              )}
              <div className="space-y-3">
                {formData.customSpecifications.map((spec, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1.4fr_auto]"
                  >
                    <Input
                      value={spec.title}
                      placeholder="Specification title"
                      onChange={(event) =>
                        handleCustomSpecificationChange(
                          index,
                          "title",
                          event.target.value,
                        )
                      }
                    />
                    <Input
                      value={spec.value}
                      placeholder="Specification value"
                      onChange={(event) =>
                        handleCustomSpecificationChange(
                          index,
                          "value",
                          event.target.value,
                        )
                      }
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeCustomSpecification(index)}
                      className="text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Number of Units
                </label>
                <Input
                  name="units"
                  value={formData.units}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Amount Per Unit
                  </div>
                </label>
                <Input
                  name="pricePerUnit"
                  value={formData.pricePerUnit}
                  onChange={handleChange}
                  placeholder="2500"
                  required
                />
              </div>
            </div>

            <div className="space-y-4 border border-border rounded-lg p-4 bg-secondary">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Customize Units
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enable custom unit rent ( if the property units vary in
                    usage/pricing ).
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="customizeUnits"
                    checked={formData.customizeUnits}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  Enable
                </label>
              </div>

              {formData.customizeUnits && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="autoGenerateUnitNumbers"
                        checked={formData.autoGenerateUnitNumbers}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      Auto-generate unit numbers
                    </label>
                  </div>

                  {!formData.autoGenerateUnitNumbers && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Custom Unit Numbers
                      </label>
                      <Textarea
                        name="customUnitNumbers"
                        value={formData.customUnitNumbers}
                        onChange={handleChange}
                        placeholder="A-101\nA-102\nB-201"
                        className="h-24"
                      />
                      <p className="text-sm text-muted-foreground">
                        Enter one unit number per line or separate with commas.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        Detailed unit configuration
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addDetailedUnit}
                      >
                        Add Unit
                      </Button>
                    </div>

                    {formData.detailedUnits.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Add individual unit records or leave empty to generate
                        units from the count and base rent.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {formData.detailedUnits.map((unit, index) => (
                          <div
                            key={index}
                            className="space-y-3 border border-border rounded-lg p-4 bg-background"
                          >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                              <Input
                                placeholder="Unit number"
                                value={unit.unitNumber}
                                onChange={(event) =>
                                  updateDetailedUnit(
                                    index,
                                    "unitNumber",
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                type="number"
                                placeholder="Rent"
                                value={unit.rent}
                                onChange={(event) =>
                                  updateDetailedUnit(
                                    index,
                                    "rent",
                                    Number(event.target.value),
                                  )
                                }
                              />
                              <Input
                                placeholder="Unit type"
                                value={unit.unitType}
                                onChange={(event) =>
                                  updateDetailedUnit(
                                    index,
                                    "unitType",
                                    event.target.value,
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => removeDetailedUnit(index)}
                                className="text-destructive"
                              >
                                Remove
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">
                                  Unit specifications
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    addDetailedUnitSpecification(index)
                                  }
                                >
                                  Add Spec
                                </Button>
                              </div>
                              {unit.specifications?.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  Add specifics such as bedrooms, baths, or
                                  size.
                                </p>
                              )}
                              <div className="space-y-2">
                                {unit.specifications?.map((spec, specIndex) => (
                                  <div
                                    key={specIndex}
                                    className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1.4fr_auto]"
                                  >
                                    <Input
                                      placeholder="Label"
                                      value={spec.label}
                                      onChange={(event) =>
                                        updateDetailedUnitSpecification(
                                          index,
                                          specIndex,
                                          "label",
                                          event.target.value,
                                        )
                                      }
                                    />
                                    <Input
                                      placeholder="Value"
                                      value={spec.value}
                                      onChange={(event) =>
                                        updateDetailedUnitSpecification(
                                          index,
                                          specIndex,
                                          "value",
                                          event.target.value,
                                        )
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() =>
                                        removeDetailedUnitSpecification(
                                          index,
                                          specIndex,
                                        )
                                      }
                                      className="text-destructive"
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden">
              <label className="block text-sm font-medium text-foreground mb-2">
                Geography
              </label>
              <Input
                disabled={true}
                name="geography"
                value={formData.geography}
                onChange={handleChange}
                placeholder="e.g., urban, suburban, rural"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Latitude
                </label>
                <Input
                  type="text"
                  name="location.lat"
                  value={formData.location.lat}
                  onChange={handleChange}
                  placeholder="e.g., 37.7749"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Longitude
                </label>
                <Input
                  type="text"
                  name="location.lng"
                  value={formData.location.lng}
                  onChange={handleChange}
                  placeholder="e.g., -122.4194"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Features
              </label>
              <Textarea
                name="features"
                value={formData.features}
                onChange={handleChange}
                placeholder="List key property features... (separate with  commas ie `parking, gym, pet-friendly` )"
                className="h-20"
              />
            </div>

            <div className="border border-border rounded-lg bg-secondary">
              <button
                type="button"
                onClick={() => setShowAdvancedSection((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-border transition-colors"
                aria-expanded={showAdvancedSection}
              >
                <span>Financial & Legal Details (Optional)</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showAdvancedSection ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showAdvancedSection && (
                <div className="grid grid-cols-1 gap-4 p-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Zoning
                    </label>
                    <Input
                      name="zoning"
                      value={formData.zoning}
                      onChange={handleChange}
                      placeholder="e.g., residential, mixed-use"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Permitted Uses
                    </label>
                    <Input
                      name="permittedUses"
                      value={formData.permittedUses}
                      onChange={handleChange}
                      placeholder="e.g., retail, office, multifamily"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Annual Property Taxes
                      </label>
                      <Input
                        type="number"
                        name="annualPropertyTaxes"
                        value={formData.annualPropertyTaxes}
                        onChange={handleChange}
                        placeholder="e.g., 18000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Annual Insurance
                      </label>
                      <Input
                        type="number"
                        name="annualInsurance"
                        value={formData.annualInsurance}
                        onChange={handleChange}
                        placeholder="e.g., 12000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Appraised Value
                      </label>
                      <Input
                        type="number"
                        name="appraisedValue"
                        value={formData.appraisedValue}
                        onChange={handleChange}
                        placeholder="e.g., 2500000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Last Appraisal Date
                      </label>
                      <Input
                        type="date"
                        name="lastAppraisalDate"
                        value={formData.lastAppraisalDate}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Net Operating Income (NOI)
                      </label>
                      <Input
                        type="number"
                        name="noi"
                        value={formData.noi}
                        onChange={handleChange}
                        placeholder="e.g., 145000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Capitalization Rate (Cap Rate)
                      </label>
                      <Input
                        type="number"
                        name="capRate"
                        value={formData.capRate}
                        onChange={handleChange}
                        placeholder="e.g., 5.5"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!initialData && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Image URL
                </label>
                <Input
                  name="imageUrl"
                  value={formData.imageUrl || ""}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                />

                {!isEditMode && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Or upload from your computer
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={triggerFileSelect}
                        className="px-3"
                      >
                        Upload Image
                      </Button>
                      <span className="text-sm text-foreground">
                        {selectedImage
                          ? selectedImage.name
                          : "No file selected"}
                      </span>
                      {selectedImage && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedImage(null)}
                          className="text-sm"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    {previewUrl && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-foreground mb-2">
                          Preview
                        </p>
                        <img
                          src={previewUrl}
                          alt="Selected preview"
                          className="max-h-40 w-auto rounded border"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add details about the property..."
                className="h-24"
              />
            </div>

            <div className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Policies
                </h3>
                <p className="text-sm text-muted-foreground">
                  Define property-level policies (pet, parking, lease terms, and
                  other policies).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="policies.petPolicy.allowed"
                      checked={Boolean(formData.policies?.petPolicy?.allowed)}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span className="text-sm font-medium">Allow Pets</span>
                  </label>
                  <Textarea
                    name="policies.petPolicy.details"
                    value={formData.policies?.petPolicy?.details || ""}
                    onChange={handleChange}
                    placeholder="Details about pet policy"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="policies.parkingPolicy.allowed"
                      checked={Boolean(
                        formData.policies?.parkingPolicy?.allowed,
                      )}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span className="text-sm font-medium">Parking Allowed</span>
                  </label>
                  <Textarea
                    name="policies.parkingPolicy.details"
                    value={formData.policies?.parkingPolicy?.details || ""}
                    onChange={handleChange}
                    placeholder="Details about parking policy"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Lease Policy
                </label>
                <Textarea
                  name="policies.leasePolicy"
                  value={formData.policies?.leasePolicy || ""}
                  onChange={handleChange}
                  placeholder="Full lease policy or summary"
                  rows={4}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Other Policies
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addOtherPolicy}
                  >
                    Add Policy
                  </Button>
                </div>
                <div className="space-y-3 mt-2">
                  {(formData.policies?.otherPolicies || []).map((op, i) => (
                    <div
                      key={i}
                      className="space-y-2 border border-border rounded p-3"
                    >
                      <Input
                        value={op.title}
                        placeholder="Title"
                        onChange={(e) =>
                          updateOtherPolicy(i, "title", e.target.value)
                        }
                      />
                      <Input
                        value={op.body}
                        placeholder="Body"
                        onChange={(e) =>
                          updateOtherPolicy(i, "body", e.target.value)
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeOtherPolicy(i)}
                          className="text-destructive"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Service Fee (monthly)
                  </label>
                  <Input
                    name="serviceFee"
                    type="number"
                    value={formData.serviceFee ?? 0}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        serviceFee: Number(e.target.value),
                      }))
                    }
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional monthly service fee added to each tenant's monthly
                    total.
                  </p>
                </div>
              </div>
            </div>

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
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Adding..."}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Property"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
