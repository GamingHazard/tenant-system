"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddTenantForm from "@/components/forms/add-tenant-form";
import {
  createTenantApi,
  listTenantsApi,
  setTenantActiveStatusApi,
  TENANT_LIST_FIELDS,
  TenantRecord,
} from "@/lib/services/tenants";
import { useAppData } from "@/lib/data-context";
import { queryClient } from "@/lib/query-client";
import {
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  ArrowRight,
  MoreVertical,
  Eye,
  DollarSign,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { CsvColumn, downloadCsvFile } from "@/lib/csv";
import RecordPaymentModal from "@/components/modals/record-payment-modal";

import { useAuth } from "@/lib/auth-context";
import {
  AdminSkeletonHeader,
  AdminTableSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { useActiveCurrency } from "@/lib/hooks/use-active-currency";
import {
  checkTenantsForDueStatus,
  getTenantIdsToMarkDue,
  logDueCheckResults,
} from "@/lib/services/tenant-due-checker";
import { markTenantsAsDueApi } from "@/lib/services/tenants";

export default function TenantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "paid" | "due" | "moving-out"
  >("all");

  const activeCurrency = useActiveCurrency();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  const { tenants, properties, isLoading, isFetching } = useAppData();
  const isPageLoading = isLoading || (isFetching && tenants.length === 0);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [isCheckingDues, setIsCheckingDues] = useState(false);
  const [lastDueCheck, setLastDueCheck] = useState<number>(0);

  const { token } = useAuth();
  const apiStatus = filterStatus === "moving-out" ? "moving out" : filterStatus;

  const tenantsQuery = useQuery({
    queryKey: [
      "tenantsList",
      token || "",
      searchQuery,
      apiStatus,
      currentPage,
      pageSize,
    ],
    queryFn: async () =>
      listTenantsApi({
        token: token ?? undefined,
        fields: TENANT_LIST_FIELDS,
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: apiStatus === "all" ? undefined : apiStatus,
      }),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const tenantsData = tenantsQuery.data ?? tenants;

  const enrichedTenants = tenantsData.map((tenant) => {
    const property =
      properties.find(
        (p) => p.id === tenant.propertyId || p._id === tenant.propertyId,
      ) || null;
    return {
      ...tenant,
      property,
    };
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, pageSize]);

  // Auto-check for tenants whose lease end dates have passed
  // and mark them as due. Runs on load and every 10 seconds.
  useEffect(() => {
    const checkAndUpdateDueTenants = async () => {
      try {
        // Debounce: skip if we just checked within last 5 seconds
        const now = Date.now();
        if (now - lastDueCheck < 5000) return;

        setIsCheckingDues(true);
        const tenantIds = getTenantIdsToMarkDue(enrichedTenants);

        if (tenantIds.length > 0) {
          logDueCheckResults(enrichedTenants, false);
          await markTenantsAsDueApi(tenantIds, token ?? undefined);
          setLastDueCheck(now);
        }
      } catch (error) {
        console.error("[Tenants Page] Failed to update due tenants:", error);
      } finally {
        setIsCheckingDues(false);
      }
    };

    // Check immediately on mount
    checkAndUpdateDueTenants();

    // Then check every 10 seconds while page is open
    const interval = setInterval(checkAndUpdateDueTenants, 10000);

    return () => clearInterval(interval);
  }, [enrichedTenants, token, lastDueCheck]);

  const isServerTenantPagination = tenantsQuery.data !== undefined;

  const filteredTenants = isServerTenantPagination
    ? enrichedTenants
    : enrichedTenants.filter((tenant) => {
        const matchesSearch =
          tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tenant.email.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesStatus = true;
        if (filterStatus === "paid") {
          matchesStatus = tenant.status === "paid";
        } else if (filterStatus === "due") {
          matchesStatus = tenant.status === "due";
        } else if (filterStatus === "moving-out") {
          matchesStatus = tenant.status === "moving out";
        }

        return matchesSearch && matchesStatus;
      });

  const totalTenantPages = isServerTenantPagination
    ? currentPage + 1
    : Math.max(1, Math.ceil(filteredTenants.length / pageSize));

  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const tenantDisplay = isServerTenantPagination
    ? enrichedTenants
    : paginatedTenants;

  const tenantPageStart = (currentPage - 1) * pageSize + 1;
  const tenantPageEnd = isServerTenantPagination
    ? tenantPageStart + tenantDisplay.length - 1
    : Math.min(currentPage * pageSize, filteredTenants.length);

  const hasNextTenantPage = isServerTenantPagination
    ? tenantDisplay.length === pageSize
    : currentPage < totalTenantPages;

  const tenantCsvColumns: CsvColumn<(typeof enrichedTenants)[number]>[] = [
    { label: "ID", value: (item) => item.id },
    { label: "_id", value: (item) => item._id },
    { label: "Name", value: (item) => item.name },
    { label: "Email", value: (item) => item.email },
    { label: "Phone", value: (item) => item.phone },
    { label: "Tenant Type", value: (item) => item.tenantType },
    { label: "Unit Number", value: (item) => item.unitNumber },
    { label: "Property ID", value: (item) => item.propertyId },
    {
      label: "Property Name",
      value: (item) => item.property?.name || "",
    },
    { label: "Rent Amount", value: (item) => item.rentAmount },
    { label: "Lease Type", value: (item) => item.leaseType },
    { label: "Lease Start Date", value: (item) => item.leaseStartDate },
    { label: "Lease End Date", value: (item) => item.leaseEndDate },
    { label: "Lease Terms", value: (item) => item.leaseTerms },
    {
      label: "Preferred Contact Method",
      value: (item) => item.preferredContactMethod,
    },
    { label: "Application Date", value: (item) => item.applicationDate },
    { label: "Move In Date", value: (item) => item.moveInDate },
    { label: "Date Of Birth", value: (item) => item.dateOfBirth },
    { label: "Employment Info", value: (item) => item.employmentInfo },
    { label: "Previous Addresses", value: (item) => item.previousAddresses },
    { label: "Co-signer", value: (item) => item.coSigner },
    { label: "Pets", value: (item) => item.pets },
    { label: "Vehicles", value: (item) => item.vehicles },
    { label: "Business Info", value: (item) => item.businessInfo },
    { label: "Business Contacts", value: (item) => item.businessContacts },
    { label: "Financial Info", value: (item) => item.financialInfo },
    { label: "Security Deposit", value: (item) => item.securityDeposit },
    { label: "Emergency Contact", value: (item) => item.emergencyContact },
    {
      label: "Emergency Contact Name",
      value: (item) => item.emergencyContactName,
    },
    {
      label: "Emergency Contact Phone",
      value: (item) => item.emergencyContactPhone,
    },
    {
      label: "Emergency Contact Email",
      value: (item) => item.emergencyContactEmail,
    },
    { label: "Notes", value: (item) => item.notes },
    { label: "Document Delivery", value: (item) => item.documentDelivery },
    { label: "Move Out Notice", value: (item) => item.moveOutNotice },
    { label: "Avatar", value: (item) => item.avatar },
    { label: "Current Balance", value: (item) => item.currentBalance },
    { label: "Is Blocked", value: (item) => item.isBlocked },
    { label: "Address", value: (item) => item.address },
    { label: "City", value: (item) => item.city },
    { label: "Postal Code", value: (item) => item.postalCode },
    { label: "Country", value: (item) => item.country },
    { label: "Status", value: (item) => item.status },
    { label: "Tenant Notes", value: (item) => item.notes },
  ];

  const handleExportTenantsCsv = () => {
    downloadCsvFile("tenants.csv", tenantCsvColumns, filteredTenants);
  };

  const getStatusColor = (tenant: (typeof enrichedTenants)[number]) => {
    if (tenant.status === "moving out")
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    if (tenant.status === "due")
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
    return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
  };

  const getStatusLabel = (tenant: (typeof enrichedTenants)[number]) => {
    if (tenant.status === "moving out") return "leaving";
    if (tenant.status === "due") return "Due";
    return "Paid";
  };

  const getPortalStatusColor = (tenant: (typeof enrichedTenants)[number]) => {
    const isActive = tenant.isActive?.status ?? true; // default to true if not set
    return isActive
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  };

  const getPortalStatusLabel = (tenant: (typeof enrichedTenants)[number]) => {
    const isActive = tenant.isActive?.status ?? true; // default to true if not set
    return isActive ? "Active" : "Inactive";
  };

  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  const handleToggleTenantActive = async (tenant: any) => {
    try {
      setTogglingStatus(tenant.id || tenant._id);
      const currentStatus = tenant.isActive?.status ?? true;
      await setTenantActiveStatusApi(
        tenant.id || tenant._id,
        !currentStatus,
        token ?? undefined,
      );
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (error) {
      console.error("Failed to toggle tenant status:", error);
    } finally {
      setTogglingStatus(null);
    }
  };

  const calculateLeaseEnd = (leaseStart: string, leaseType: string) => {
    const startDate = new Date(leaseStart);
    let months = 1;

    if (leaseType === "full year") {
      months = 12;
    } else if (leaseType === "6mnths") {
      months = 6;
    } else if (leaseType === "3mnths") {
      months = 3;
    } else if (leaseType === "monthly") {
      months = 1;
    }

    const leaseEnd = new Date(startDate);
    leaseEnd.setMonth(leaseEnd.getMonth() + months);
    return leaseEnd;
  };

  const handleAddTenant = async (data: any) => {
    setIsCreatingTenant(true);
    try {
      const payload: Partial<TenantRecord> = {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        preferredName: data.preferredName,
        middleName: data.middleName,
        gender: data.gender,
        maritalStatus: data.maritalStatus,
        nationality: data.nationality,
        placeOfOrigin: data.placeOfOrigin,
        hasFamily: data.hasFamily === "yes",
        householdMembers: data.householdMembers
          ? data.householdMembers.split("\n").filter(Boolean)
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
        propertyId: data.propertyId,
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
          ? data.previousAddresses.split("\n").filter(Boolean)
          : undefined,
        coSigner: data.coSigner,
        pets: data.pets,
        vehicles: data.vehicles,
        businessInfo: data.businessInfo,
        businessContacts: data.businessContacts,
        financialInfo: data.financialInfo,
        securityDeposit: data.securityDeposit,
        emergencyContact: data.emergencyContact,
        notes: data.notes,
        status: "due",
      };
      const tenant = await createTenantApi(payload, token || undefined);
      queryClient.invalidateQueries({
        queryKey: ["tenants"] as const,
      });
      console.log("New tenant created:", tenant);
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to create tenant:", error);
    } finally {
      setIsCreatingTenant(false);
    }
  };

  return (
    <div className="space-y-6">
      <AddTenantForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSubmit={handleAddTenant}
        isLoading={isCreatingTenant}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Tenants</h1>
          <p className="text-muted-foreground">
            Manage tenant information, leases, and communications
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tenant
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="border  border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportTenantsCsv()}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
            >
              <option value="all">All Status</option>
              <option value="paid">Rent Paid</option>
              <option value="due">Payment Due</option>
              <option value="moving-out">Moving Out</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tenants Table */}
      <Card className="border  border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Monthly Rent
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Lease Type
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Portal Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Lease Start
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Lease End
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tenantDisplay.map((tenant, index) => (
                <tr
                  key={tenant.id || index}
                  className="border-b border-border hover:bg-secondary transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-foreground">
                    {tenant.name}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-blue-600">
                    <Link
                      className="hover:underline"
                      href={
                        tenant.property
                          ? `/dashboard/properties/${tenant.property.id || tenant.property._id}`
                          : "#"
                      }
                    >
                      {tenant.property ? tenant.property.name : "N/A"}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {tenant.unitNumber || "--"}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <a
                      href={`mailto:${tenant.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {tenant.email}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <a
                      href={`tel:${tenant.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {tenant.phone}
                    </a>
                  </td>
                  <td className="px-6 py-4 font-semibold text-foreground">
                    {(() => {
                      const rent = Number(tenant.rentAmount ?? 0);
                      return (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            Tenant rent
                          </div>
                          <div className="font-semibold">
                            {formatCurrency(rent, activeCurrency)}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-xs text-foreground capitalize">
                    {(tenant.leaseType || "").replace("_", " ")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(tenant)}`}
                    >
                      {getStatusLabel(tenant)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${getPortalStatusColor(tenant)}`}
                    >
                      {getPortalStatusLabel(tenant)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {tenant.leaseStartDate
                      ? new Date(tenant.leaseStartDate).toLocaleDateString()
                      : "--"}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {tenant.leaseEndDate
                      ? new Date(tenant.leaseEndDate).toLocaleDateString()
                      : tenant.leaseStartDate
                        ? calculateLeaseEnd(
                            tenant.leaseStartDate || "",
                            tenant.leaseType || "",
                          ).toLocaleDateString()
                        : "--"}
                  </td>
                  <td className="px-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border bg-transparent"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/tenants/${tenant.id || tenant._id}`}
                            className="flex items-center"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setShowRecordPayment(true);
                          }}
                        >
                          <DollarSign className="mr-2 h-4 w-4" />
                          Record Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleTenantActive(tenant)}
                          disabled={
                            togglingStatus === (tenant.id || tenant._id)
                          }
                        >
                          {togglingStatus === (tenant.id || tenant._id)
                            ? "Updating..."
                            : (tenant.isActive?.status ?? true)
                              ? "Deactivate Portal"
                              : "Activate Portal"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {tenantDisplay.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Showing {tenantPageStart}-{tenantPageEnd}{" "}
            {isServerTenantPagination
              ? `tenants`
              : `of ${filteredTenants.length} tenants`}
          </p>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-foreground">
              Page {currentPage}
              {!isServerTenantPagination && ` of ${totalTenantPages}`}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasNextTenantPage}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              Next
            </Button>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {[10, 20, 40].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <RecordPaymentModal
        open={showRecordPayment}
        onOpenChange={(v) => {
          setShowRecordPayment(v);
          if (!v) setSelectedTenant(null);
        }}
        tenantId={selectedTenant?.id}
        propertyId={selectedTenant?.propertyId}
      />

      {/* Empty State */}
      {filteredTenants.length === 0 && (
        <Card className="border flex justify-center items-center border-border flex-1 h-screen p-12 text-center">
          <span>
            <img
              src="/no-user.webp"
              alt="No tenants found"
              className="w-96 h-96 text-muted-foreground mx-auto mb-4 opacity-50"
            />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No tenants found
            </h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
          </span>
        </Card>
      )}
    </div>
  );
}
