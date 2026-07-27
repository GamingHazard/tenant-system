"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/lib/data-context";
import { Calendar, Mail, Phone, User, X, Loader2 } from "lucide-react";

interface TenantFormData {
  name: string;
  email: string;
  phone: string;
  preferredName: string;
  middleName: string;
  gender: "male" | "female" | "non-binary" | "other";
  maritalStatus: "single" | "married" | "divorced" | "widowed" | "separated";
  nationality: string;
  placeOfOrigin: string;
  hasFamily: "yes" | "no";
  householdMembers: string;
  cohabitantName: string;
  cohabitantRelationship: string;
  occupation: string;
  employerName: string;
  position: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinEmail: string;
  tenantType: "residential" | "commercial" | "mixed";
  propertyId: string;
  unitNumber: string;
  leaseStartDate: string;
  leaseEndDate: string;
  leaseType: string;
  leaseTerms: string;
  preferredContactMethod: "email" | "phone" | "sms";
  applicationDate: string;
  moveInDate: string;
  password: string;
  monthlyRent: string | number;
  emergencyContact: string;
  notes: string;
  dateOfBirth: string;
  employmentInfo: string;
  previousAddresses: string;
  coSigner: string;
  pets: string;
  vehicles: string;
  businessInfo: string;
  businessContacts: string;
  financialInfo: string;
  securityDeposit: string;
  policyGivenTitle: string;
  policyGivenBody: string;
  policyExceptions: string;
}

export interface TenantFormProps {
  mode: "create" | "edit";
  initialData?: Partial<TenantFormData>;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: TenantFormData) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  renewalDateHint?: string | null;
}

const createEmptyTenantFormData = (): TenantFormData => ({
  name: "",
  email: "",
  phone: "",
  tenantType: "residential",
  propertyId: "",
  unitNumber: "",
  leaseStartDate: "",
  leaseEndDate: "",
  leaseType: "monthly",
  leaseTerms: "",
  preferredContactMethod: "email",
  applicationDate: "",
  moveInDate: "",
  password: "",
  preferredName: "",
  middleName: "",
  gender: "male",
  maritalStatus: "single",
  nationality: "",
  placeOfOrigin: "",
  hasFamily: "yes",
  householdMembers: "",
  cohabitantName: "",
  cohabitantRelationship: "",
  occupation: "",
  employerName: "",
  position: "",
  nextOfKinName: "",
  nextOfKinRelationship: "",
  nextOfKinPhone: "",
  nextOfKinEmail: "",
  monthlyRent: 0,
  emergencyContact: "",
  notes: "",
  dateOfBirth: "",
  employmentInfo: "",
  previousAddresses: "",
  coSigner: "",
  pets: "",
  vehicles: "",
  businessInfo: "",
  businessContacts: "",
  financialInfo: "",
  securityDeposit: "",
  policyGivenTitle: "",
  policyGivenBody: "",
  policyExceptions: "",
});

export default function TenantForm({
  mode,
  initialData,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  errorMessage = null,
  renewalDateHint = null,
}: TenantFormProps) {
  const [formData, setFormData] = useState<TenantFormData>(
    createEmptyTenantFormData(),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const { properties, tenants } = useAppData();

  const availableProperties = useMemo(() => {
    return (properties || []).map((property) => {
      const propertyId = property._id || property.id;
      const units = Array.isArray(property.units) ? property.units : [];
      const occupiedUnits = (tenants || [])
        .filter((tenant) => tenant.propertyId === propertyId)
        .map(
          (tenant) => (tenant as any).unitNumber || (tenant as any).unit || "",
        )
        .filter(Boolean);
      const availableUnits = units.filter(
        (unit) => !occupiedUnits.includes(unit),
      );
      return {
        ...property,
        units,
        availableUnits,
        hasAvailableUnits: availableUnits.length > 0,
      };
    });
  }, [properties, tenants]);

  // Helper function to format dates from ISO to YYYY-MM-DD for HTML date inputs
  const formatDateForInput = (dateString: string | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setFormError(null);
      if (mode === "edit" && initialData) {
        setFormData({
          ...createEmptyTenantFormData(),
          name: initialData.name || "",
          email: initialData.email || "",
          phone: initialData.phone || "",
          tenantType: initialData.tenantType || "residential",
          propertyId: initialData.propertyId || "",
          unitNumber: initialData.unitNumber || "",
          leaseStartDate: formatDateForInput(initialData.leaseStartDate),
          leaseEndDate: formatDateForInput(initialData.leaseEndDate),
          leaseType: initialData.leaseType || "monthly",
          leaseTerms: initialData.leaseTerms || "",
          preferredContactMethod: initialData.preferredContactMethod || "email",
          applicationDate: formatDateForInput(initialData.applicationDate),
          moveInDate: formatDateForInput(initialData.moveInDate),
          password: initialData.password || "",
          preferredName: initialData.preferredName || "",
          middleName: initialData.middleName || "",
          gender: initialData.gender || "male",
          maritalStatus: initialData.maritalStatus || "single",
          nationality: initialData.nationality || "",
          placeOfOrigin: initialData.placeOfOrigin || "",
          hasFamily: initialData.hasFamily ? "yes" : "no",
          householdMembers: Array.isArray(initialData.householdMembers)
            ? initialData.householdMembers
                .map((member) => member.name)
                .filter(Boolean)
                .join(", ")
            : String(initialData.householdMembers || ""),
          cohabitantName: initialData.cohabitant?.name || "",
          cohabitantRelationship: initialData.cohabitant?.relationship || "",
          occupation: initialData.occupation || "",
          employerName: initialData.employerName || "",
          position: initialData.position || "",
          nextOfKinName: initialData.nextOfKin?.name || "",
          nextOfKinRelationship: initialData.nextOfKin?.relationship || "",
          nextOfKinPhone: initialData.nextOfKin?.phone || "",
          nextOfKinEmail: initialData.nextOfKin?.email || "",
          monthlyRent: initialData.monthlyRent || 0,
          emergencyContact: initialData.emergencyContact || "",
          notes: initialData.notes || "",
          dateOfBirth: formatDateForInput(initialData.dateOfBirth),
          employmentInfo: initialData.employmentInfo || "",
          previousAddresses: initialData.previousAddresses || "",
          coSigner: initialData.coSigner || "",
          pets: initialData.pets || "",
          vehicles: initialData.vehicles || "",
          businessInfo: initialData.businessInfo || "",
          businessContacts: initialData.businessContacts || "",
          financialInfo: initialData.financialInfo || "",
          securityDeposit: initialData.securityDeposit || "",
        });
      } else if (mode === "create") {
        setFormData(createEmptyTenantFormData());
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, mode]);

  const generatePassword = (length = 8) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let pw = "";
    for (let i = 0; i < length; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "monthlyRent" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const calculateLeaseEndDate = (dateString: string, leaseType: string) => {
    if (!dateString) return "";
    const start = new Date(dateString);
    if (Number.isNaN(start.getTime())) return "";

    let months = 1;
    switch (leaseType) {
      case "monthly":
      case "month-to-month":
        months = 1;
        break;
      case "3_months":
      case "3 months":
        months = 3;
        break;
      case "half_year":
      case "6mnths":
        months = 6;
        break;
      case "full_year":
      case "annual":
      case "yearly":
        months = 12;
        break;
      default:
        months = 1;
    }

    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    return end.toISOString().slice(0, 10);
  };

  useEffect(() => {
    const baseDate = formData.leaseStartDate;
    if (!baseDate) return;
    const calculatedEnd = calculateLeaseEndDate(baseDate, formData.leaseType);
    if (calculatedEnd && calculatedEnd !== formData.leaseEndDate) {
      setFormData((prev) => ({ ...prev, leaseEndDate: calculatedEnd }));
    }
  }, [formData.leaseStartDate, formData.leaseType]);

  const getAgeFromDob = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }
    return age;
  };

  const getDobMaxValue = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    return today.toISOString().slice(0, 10);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.dateOfBirth) {
      setFormError("Date of birth is required.");
      return;
    }

    const age = getAgeFromDob(formData.dateOfBirth);
    if (age === null) {
      setFormError("Date of birth is invalid.");
      return;
    }

    if (age < 18) {
      setFormError("Tenant must be at least 18 years old.");
      return;
    }

    const sanitizedData = {
      ...formData,
      monthlyRent:
        formData.monthlyRent === "" ? 0 : Number(formData.monthlyRent),
    };
    // assemble policyGiven object if present
    if (formData.policyGivenTitle || formData.policyGivenBody) {
      sanitizedData.policyGiven = {
        title: formData.policyGivenTitle || undefined,
        body: formData.policyGivenBody || undefined,
        sourcePropertyId: formData.propertyId || undefined,
      };
    }
    if (formData.policyExceptions)
      sanitizedData.policyExceptions = formData.policyExceptions;
    onSubmit?.(sanitizedData);
  };

  const selectedProperty = availableProperties.find(
    (p) => (p._id || p.id) === formData.propertyId,
  );

  const unitOptions = selectedProperty?.availableUnits ?? [];
  const normalizedUnitOptions = useMemo(() => {
    const values = Array.isArray(unitOptions) ? unitOptions : [];
    const distinctValues = Array.from(
      new Set(
        values
          .map((unit) => {
            if (typeof unit === "string") return unit;
            if (unit && typeof unit === "object") {
              return (unit as any).unitNumber || (unit as any).unit || "";
            }
            return "";
          })
          .filter(Boolean),
      ),
    );

    if (!formData.unitNumber) return distinctValues;

    return Array.from(new Set([formData.unitNumber, ...distinctValues]));
  }, [formData.unitNumber, unitOptions]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {mode === "create" ? "Add New Tenant" : "Edit Tenant"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "create"
                  ? "Register a new tenant to a property"
                  : "Update tenant information"}
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
            <section className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Profile
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tenant identity, contact preferences and basic profile
                  details.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Full Name
                    </div>
                  </label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      Email
                    </div>
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      Phone Number
                    </div>
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tenant Type
                  </label>
                  <select
                    name="tenantType"
                    value={formData.tenantType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Preferred Contact
                  </label>
                  <select
                    name="preferredContactMethod"
                    value={formData.preferredContactMethod}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date of Birth
                  </label>
                  <Input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Preferred Name
                  </label>
                  <Input
                    name="preferredName"
                    value={formData.preferredName}
                    onChange={handleChange}
                    placeholder="Preferred name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Middle Name
                  </label>
                  <Input
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    placeholder="Middle name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Marital Status
                  </label>
                  <select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nationality
                  </label>
                  <Input
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    placeholder="Country"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Place of Origin
                  </label>
                  <Input
                    name="placeOfOrigin"
                    value={formData.placeOfOrigin}
                    onChange={handleChange}
                    placeholder="City or region"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Occupation
                  </label>
                  <Input
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    placeholder="Job title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Employer
                  </label>
                  <Input
                    name="employerName"
                    value={formData.employerName}
                    onChange={handleChange}
                    placeholder="Employer name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Position
                  </label>
                  <Input
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    placeholder="Role or title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Family Status
                  </label>
                  <select
                    name="hasFamily"
                    value={formData.hasFamily}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              {formData.hasFamily === "yes" && (
                <div className="space-y-4 border border-border rounded-lg p-4 bg-background">
                  <p className="text-sm font-semibold text-foreground">
                    Household Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Household Members
                      </label>
                      <Input
                        name="householdMembers"
                        value={formData.householdMembers}
                        onChange={handleChange}
                        placeholder="Comma-separated names"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cohabitant Relationship
                      </label>
                      <Input
                        name="cohabitantRelationship"
                        value={formData.cohabitantRelationship}
                        onChange={handleChange}
                        placeholder="Relationship"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cohabitant Name
                      </label>
                      <Input
                        name="cohabitantName"
                        value={formData.cohabitantName}
                        onChange={handleChange}
                        placeholder="Name"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Next of Kin Name
                  </label>
                  <Input
                    name="nextOfKinName"
                    value={formData.nextOfKinName}
                    onChange={handleChange}
                    placeholder="Next of kin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Next of Kin Relationship
                  </label>
                  <Input
                    name="nextOfKinRelationship"
                    value={formData.nextOfKinRelationship}
                    onChange={handleChange}
                    placeholder="Relationship"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Next of Kin Phone
                  </label>
                  <Input
                    name="nextOfKinPhone"
                    value={formData.nextOfKinPhone}
                    onChange={handleChange}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Next of Kin Email
                  </label>
                  <Input
                    type="email"
                    name="nextOfKinEmail"
                    value={formData.nextOfKinEmail}
                    onChange={handleChange}
                    placeholder="Email address"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Tenancy
                </h3>
                <p className="text-sm text-muted-foreground">
                  Property assignment, lease terms, dates and billing details.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Property
                  </label>
                  <select
                    name="propertyId"
                    value={formData.propertyId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Property</option>
                    {availableProperties.length === 0 && (
                      <option value="" disabled>
                        No properties found
                      </option>
                    )}
                    {availableProperties.map((property, index) => (
                      <option
                        key={property._id || index}
                        value={property._id}
                        disabled={(property.availableUnits?.length ?? 0) === 0}
                      >
                        {property.name} - {property.address}, {property.city} (
                        {(property.availableUnits?.length ?? 0) === 0
                          ? "No units available"
                          : `${property.availableUnits?.length ?? 0} units available`}
                        )
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Unit Number
                  </label>
                  <select
                    name="unitNumber"
                    value={formData.unitNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    disabled={!formData.propertyId}
                  >
                    <option value="">Select Unit</option>
                    {formData.propertyId &&
                      (normalizedUnitOptions.length ? (
                        normalizedUnitOptions.map((unit, index) => (
                          <option key={`${unit}-${index}`} value={unit}>
                            {unit}
                          </option>
                        ))
                      ) : (
                        <option key="none" value="" disabled>
                          No units available
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <div className="flex items-center text-xs gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      Lease Start Date
                    </div>
                  </label>
                  <Input
                    type="date"
                    name="leaseStartDate"
                    value={formData.leaseStartDate}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">
                    Lease End Date
                  </label>
                  <Input
                    type="date"
                    name="leaseEndDate"
                    value={formData.leaseEndDate}
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculated from lease start/renewal date and lease type.
                  </p>
                  {renewalDateHint ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {renewalDateHint}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">
                    Lease Type
                  </label>
                  <select
                    name="leaseType"
                    value={formData.leaseType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="monthly">Monthly</option>
                    <option value="3_months">3 Months</option>
                    <option value="half_year">6 Months</option>
                    <option value="full_year">12 Months</option>
                    <option value="month-to-month">Month-to-Month</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Application Date
                  </label>
                  <Input
                    type="date"
                    name="applicationDate"
                    value={formData.applicationDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Move-in Date
                  </label>
                  <Input
                    type="date"
                    name="moveInDate"
                    value={formData.moveInDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="lg:col-span-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Lease Terms
                  </label>
                  <Input
                    name="leaseTerms"
                    value={formData.leaseTerms}
                    onChange={handleChange}
                    placeholder="e.g., 12-month fixed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Monthly Rent
                  </label>
                  <Input
                    name="monthlyRent"
                    value={formData.monthlyRent}
                    onChange={handleChange}
                    placeholder="2500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Emergency Contact
                  </label>
                  <Input
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleChange}
                    placeholder="Contact name or number"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Policies
                </h3>
                <p className="text-sm text-muted-foreground">
                  Review tenant policy expectations and communication
                  preferences.
                </p>
                <p className="text-sm text-muted-foreground">
                  Lease terms, house rules and tenant responsibilities are
                  managed by the property administrator.
                </p>
                {selectedProperty?.policies && (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {selectedProperty.policies.leasePolicy && (
                      <div>
                        <p className="font-medium text-foreground">
                          Lease Policy
                        </p>
                        <p className="text-xs">
                          {selectedProperty.policies.leasePolicy}
                        </p>
                      </div>
                    )}
                    {selectedProperty.policies.petPolicy &&
                      selectedProperty.policies.petPolicy.details && (
                        <div>
                          <p className="font-medium text-foreground">
                            Pet Policy
                          </p>
                          <p className="text-xs">
                            {selectedProperty.policies.petPolicy.details}
                          </p>
                        </div>
                      )}
                    {Array.isArray(selectedProperty.policies.otherPolicies) &&
                      selectedProperty.policies.otherPolicies.length > 0 && (
                        <div>
                          <p className="font-medium text-foreground">
                            Other Policies
                          </p>
                          <ul className="text-xs list-disc ml-4">
                            {selectedProperty.policies.otherPolicies.map(
                              (op, i) => (
                                <li key={i}>
                                  {op.title}: {op.body}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Assigned Policy Title
                  </label>
                  <Input
                    name="policyGivenTitle"
                    value={formData.policyGivenTitle}
                    onChange={handleChange}
                    placeholder="Optional short title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Assigned Policy (custom)
                  </label>
                  <Textarea
                    name="policyGivenBody"
                    value={formData.policyGivenBody}
                    onChange={handleChange}
                    placeholder="Optional policy text for this tenant"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Policy Exceptions / Notes
                  </label>
                  <Textarea
                    name="policyExceptions"
                    value={formData.policyExceptions}
                    onChange={handleChange}
                    placeholder="Any exceptions or notes for this tenant"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Financials
                </h3>
                <p className="text-sm text-muted-foreground">
                  Household, employment, and business financial details for
                  tenant review.
                </p>
              </div>
              {(formData.tenantType === "residential" ||
                formData.tenantType === "mixed") && (
                <div className="space-y-4 border border-border rounded-lg p-4 bg-background">
                  <p className="text-sm font-semibold text-foreground">
                    Residential Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Co-signer
                      </label>
                      <Input
                        name="coSigner"
                        value={formData.coSigner}
                        onChange={handleChange}
                        placeholder="Co-signer name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Pets
                      </label>
                      <Input
                        name="pets"
                        value={formData.pets}
                        onChange={handleChange}
                        placeholder="Pet details"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Employment Info
                      </label>
                      <Textarea
                        name="employmentInfo"
                        value={formData.employmentInfo}
                        onChange={handleChange}
                        placeholder="Employer, income, position"
                        className="h-24"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Previous Addresses
                      </label>
                      <Textarea
                        name="previousAddresses"
                        value={formData.previousAddresses}
                        onChange={handleChange}
                        placeholder="List prior addresses"
                        className="h-24"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Vehicles
                      </label>
                      <Input
                        name="vehicles"
                        value={formData.vehicles}
                        onChange={handleChange}
                        placeholder="Vehicle make/model"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Security Deposit
                      </label>
                      <Input
                        name="securityDeposit"
                        value={formData.securityDeposit}
                        onChange={handleChange}
                        placeholder="Deposit terms"
                      />
                    </div>
                  </div>
                </div>
              )}
              {(formData.tenantType === "commercial" ||
                formData.tenantType === "mixed") && (
                <div className="space-y-4 border border-border rounded-lg p-4 bg-background">
                  <p className="text-sm font-semibold text-foreground">
                    Commercial Details
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Business Info
                    </label>
                    <Textarea
                      name="businessInfo"
                      value={formData.businessInfo}
                      onChange={handleChange}
                      placeholder="Company name, registration, industry"
                      className="h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Business Contacts
                    </label>
                    <Textarea
                      name="businessContacts"
                      value={formData.businessContacts}
                      onChange={handleChange}
                      placeholder="Primary contact, phone, email"
                      className="h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Financial Info
                    </label>
                    <Textarea
                      name="financialInfo"
                      value={formData.financialInfo}
                      onChange={handleChange}
                      placeholder="Revenue, credit terms, guarantees"
                      className="h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Security Deposit
                    </label>
                    <Input
                      name="securityDeposit"
                      value={formData.securityDeposit}
                      onChange={handleChange}
                      placeholder="Deposit terms"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Account
                </h3>
                <p className="text-sm text-muted-foreground">
                  Password management for tenant account access.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div className="flex gap-2">
                    <Input
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Auto-generate or enter manually"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          password: generatePassword(8),
                        }))
                      }
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4 bg-secondary">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Additional Notes
                </h3>
                <p className="text-sm text-muted-foreground">
                  Any extra details that should be recorded on the tenant
                  profile.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Notes
                </label>
                <Textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional notes about the tenant"
                  rows={4}
                />
              </div>
            </section>

            {(formError || errorMessage) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p>{formError || errorMessage}</p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "create" ? "Adding..." : "Saving..."}
                  </>
                ) : mode === "create" ? (
                  "Add Tenant"
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
