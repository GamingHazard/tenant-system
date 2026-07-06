"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import React, { Suspense, useCallback } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth, type User as AuthUser } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { useAdminInactivity } from "@/lib/hooks/use-admin-inactivity";
import { useAppData } from "@/lib/data-context";
import {
  LayoutDashboard,
  Building2,
  Users,
  DollarSign,
  Wrench,
  MessageSquare,
  CreditCard,
  PlusCircle,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Moon,
  Sun,
  ChevronDown,
  BarChart3,
  ItalicIcon as AnalyticsIcon,
  HelpCircle,
  Home,
  MapPin,
  Trash2,
} from "lucide-react";
import {
  getNotifications,
  deleteNotification,
} from "@/lib/services/notifications";
import {
  fetchNotifications,
  markNotificationRead,
} from "@/app/lib/notifications-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const getNotificationIcon = (
  category?: string,
  type?: string,
): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const key = (category || type || "").toLowerCase();

  switch (key) {
    case "message":
      return MessageSquare;
    case "payment":
      return CreditCard;
    case "creation":
      return PlusCircle;
    case "update":
      return RefreshCcw;
    case "delete":
      return Trash2;
    case "approval":
      return CheckCircle2;
    case "rejected":
      return XCircle;
    case "sys":
      return AlertCircle;
    default:
      return Bell;
  }
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingExpensesCount, setPendingExpensesCount] = useState(0);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const user = { name: "Alex Johnson", email: "alex@example.com" };

  const {
    user: authUser,
    isAuthenticated,
    isLoading,
    logout,
    token,
  } = useAuth();

  const typedAuthUser = authUser as AuthUser | null;
  const { settings } = useSettings();
  const { tenants: allTenants, expenses, maintenanceRequests } = useAppData();

  React.useEffect(() => {
    const pendingMaintenance = maintenanceRequests.filter(
      (req) => req.status === "pending",
    ).length;
    setPendingMaintenanceCount(pendingMaintenance);

    const pendingTenants = allTenants.filter(
      (t) =>
        t.status === "pending" ||
        t.status === undefined ||
        t.status === "awaiting",
    ).length;
    setPendingApprovalsCount(pendingTenants);

    const pendingExpenses = expenses.filter(
      (ex) => ex.status === "pending",
    ).length;
    setPendingExpensesCount(pendingExpenses);
  }, [allTenants, expenses, maintenanceRequests]);

  // Read timeout minutes from settings (stored as minutes).
  // Disable the timer entirely when auto logout is turned off.
  const autoLogoutEnabled = settings?.security?.autoLogout?.enabled;
  const timeoutSeconds =
    autoLogoutEnabled && settings?.security?.autoLogout?.durationMinutes
      ? settings.security.autoLogout.durationMinutes * 60
      : undefined;

  const handleAutoLogout = useCallback(async () => {
    try {
      await logout();
    } catch (e) {
      // ignore logout errors
    }
    router.push("/auth/login");
  }, [logout, router]);

  useAdminInactivity(timeoutSeconds, handleAutoLogout);

  const normalizeNotificationsResponse = (resp: any) => {
    if (!resp) return getNotifications();
    if (Array.isArray(resp)) return resp as any[];
    if (resp?.success && Array.isArray(resp.data)) return resp.data;
    return getNotifications();
  };

  // Load notifications (try server, fall back to local)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetchNotifications(
          undefined,
          undefined,
          undefined,
          token ?? undefined,
        );
        const list = normalizeNotificationsResponse(resp);
        if (!mounted) return;
        setNotifications(list);
      } catch (e) {
        console.error(
          "Failed to fetch notifications, falling back to local",
          e,
        );
        if (!mounted) return;
        setNotifications(getNotifications());
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Function to delete all notifications from DB and UI
  const clearAllNotifications = async () => {
    await Promise.all(
      notifications.map(async (n) => {
        try {
          await deleteNotification(n.id);
        } catch (error) {
          console.error("Failed to delete notification", error);
        }
      }),
    );
    setNotifications([]);
  };

  // Load maintenance and messages counts
  React.useEffect(() => {
    const pendingMaintenance = maintenanceRequests.filter(
      (req) => req.status === "pending",
    ).length;
    setPendingMaintenanceCount(pendingMaintenance);

    setUnreadMessagesCount(
      notifications.filter(
        (notification) =>
          !notification.read && notification.resourceType === "message",
      ).length,
    );

    // Pending tenant approvals
    try {
      const pendingTenants = allTenants.filter(
        (t) =>
          t.status === "pending" ||
          t.status === undefined ||
          t.status === "awaiting",
      ).length;
      setPendingApprovalsCount(pendingTenants);
    } catch (e) {
      setPendingApprovalsCount(0);
    }

    const pendingExpenses = expenses.filter(
      (ex) => ex.status === "pending",
    ).length;
    setPendingExpensesCount(pendingExpenses);
  }, [allTenants, expenses, maintenanceRequests]);

  const refreshNotifications = React.useCallback(async () => {
    try {
      const resp = await fetchNotifications(
        undefined,
        undefined,
        undefined,
        token ?? undefined,
      );
      setNotifications(normalizeNotificationsResponse(resp));
    } catch (e) {
      console.error("Refresh notifications failed", e);
      setNotifications(getNotifications());
    }
  }, [token]);

  // Make refreshNotifications available globally for other components
  React.useEffect(() => {
    (window as any).refreshNotifications = refreshNotifications;
    return () => {
      delete (window as any).refreshNotifications;
    };
  }, [refreshNotifications]);

  React.useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (authUser?.role !== "admin" && authUser?.role !== "property_manager") {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading, authUser, router]);

  const trialDaysRemaining = (typedAuthUser as any)?.trialDaysRemaining ?? null;
  const trialExpired = (typedAuthUser as any)?.trialExpired ?? false;
  const showTrialNotice =
    typedAuthUser &&
    !typedAuthUser.isActivated &&
    ["admin", "property_manager"].includes(typedAuthUser.role);
  const trialNoticeLabel = trialExpired
    ? "Trial expired"
    : trialDaysRemaining === 1
      ? "1 day left"
      : trialDaysRemaining != null
        ? `${trialDaysRemaining} days left`
        : null;

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const navGroups: Array<{ label?: string; items: NavItem[] }> = [
    {
      label: undefined,
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      label: "Property Management",
      items: [
        {
          label: "Properties",
          href: "/dashboard/properties",
          icon: <Building2 className="w-4 h-4" />,
        },
        {
          label: "Tenants",
          href: "/dashboard/tenants",
          icon: <Users className="w-4 h-4" />,
        },
        {
          label: "Pending Approvals",
          href: "/dashboard/admin/pending-tenants",
          icon: <Bell className="w-4 h-4" />,
          badge: pendingApprovalsCount,
        },
        {
          label: "Maintenance",
          href: "/dashboard/maintenance",
          icon: <Wrench className="w-4 h-4" />,
          badge: pendingMaintenanceCount,
        },
        ...(authUser?.role === "admin"
          ? [
              {
                label: "Visit History",
                href: "/dashboard/admin/visits",
                icon: <FileText className="w-4 h-4" />,
              },
            ]
          : []),
        // {
        //   label: "Map",
        //   href: "/dashboard/map",
        //   icon: <MapPin className="w-4 h-4" />,
        // },
      ],
    },
    {
      label: "Finances",
      items: [
        {
          label: "Finances",
          href: "/dashboard/finances",
          icon: <DollarSign className="w-4 h-4" />,
          badge: pendingExpensesCount,
        },
      ],
    },
    {
      label: "Communications",
      items: [
        {
          label: "Communications",
          href: "/dashboard/communications",
          icon: <MessageSquare className="w-4 h-4" />,
          badge: unreadMessagesCount,
        },
        // {
        //   label: "Documents",
        //   href: "/dashboard/documents",
        //   icon: <FileText className="w-4 h-4" />,
        // },
      ],
    },
    {
      label: undefined,
      items: [
        // {
        //   label: "Analytics",
        //   href: "/dashboard/analytics",
        //   icon: <BarChart3 className="w-4 h-4" />,
        // },
        {
          label: "Tenant Portal",
          href: "/dashboard/tenant-portal",
          icon: <Home className="w-4 h-4" />,
        },
      ],
    },
    {
      label: "Settings",
      items: [
        {
          label: "Settings",
          href: "/dashboard/settings",
          icon: <Settings className="w-4 h-4" />,
        },
        {
          label: "Help & Support",
          href: "/dashboard/help",
          icon: <HelpCircle className="w-4 h-4" />,
        },
      ],
    },
  ];

  // Determine the best matching nav item for the current pathname.
  // We prefer an exact match, otherwise the longest prefix match so deeper routes activate their specific item.
  const flatItems = navGroups.flatMap((g) => g.items);
  const activeHref = flatItems.reduce((best: string, item) => {
    if (!pathname) return best;
    if (pathname === item.href) return item.href;
    if (
      pathname.startsWith(item.href) &&
      item.href.length > (best?.length || 0)
    )
      return item.href;
    return best;
  }, "");

  const handleLogout = () => {
    router.push("/");
  };

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="flex h-screen bg-background text-foreground">
          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-20 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={`fixed md:relative w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-transform z-30 md:z-0 ${
              mobileMenuOpen
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }`}
          >
            {/* Sidebar Header */}
            <div className="p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="w-16 h-16 bg-sidebar-primary rounded-lg flex items-center justify-center">
                  <span className="text-sidebar-primary-foreground font-bold">
                    <img
                      src="/logo-light.png"
                      alt="Aurex Logo"
                      className="w-full h-full rounded-md object-contain"
                    />
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sidebar-foreground">Aurex</p>
                  <p className="text-xs text-sidebar-foreground/60">
                    Property Management
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              {navGroups.map((group, gi) => (
                <div key={gi} className="mb-4">
                  {group.label && (
                    <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase">
                      {group.label}
                    </div>
                  )}
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const isActive = item.href === activeHref;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                        >
                          <span
                            className={`${isActive ? "text-accent-foreground" : "text-sidebar-foreground/70"} group-hover:text-sidebar-accent-foreground`}
                          >
                            {item.icon}
                          </span>
                          <span className="flex-1 text-sm font-medium">
                            {item.label}
                          </span>
                          {(item?.badge ?? 0) > 0 && (
                            <span className="px-2 py-1 text-xs font-semibold bg-destructive text-destructive-foreground rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-sidebar-border">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Header */}
            <header className="bg-card border-b border-border h-16 flex items-center px-4 md:px-6 gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-secondary rounded-lg"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              {/* Search Bar */}
              <div className="hidden sm:flex items-center flex-1 gap-2 bg-secondary rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search properties, tenants..."
                  className="bg-transparent outline-none text-sm flex-1 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-4 ml-auto">
                {/* Trial notice */}
                {showTrialNotice && trialNoticeLabel && (
                  <button
                    type="button"
                    onClick={() => setTrialDialogOpen(true)}
                    className={`hidden md:inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      trialExpired
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {trialNoticeLabel}
                  </button>
                )}

                {/* Notifications */}
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative hidden p-2 border border-transparent hover:bg-secondary rounded-lg transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-foreground" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {/* Dark Mode Toggle */}
                <ThemeToggle />

                {/* User Menu */}
                <button className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {user?.name?.[0] ?? "U"}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-auto">
              <div className="p-4 md:p-6">{children}</div>
            </main>
          </div>

          <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {trialExpired ? "Trial Expired" : "Trial Ending Soon"}
                </DialogTitle>
                <DialogDescription>
                  {trialExpired
                    ? "Your trial period has ended. Enter a product key to continue using the dashboard."
                    : `Your trial expires in ${trialDaysRemaining} day${
                        trialDaysRemaining === 1 ? "" : "s"
                      }. Enter a product key to keep your account active.`}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                <p>
                  Product key activation unlocks your account and keeps the
                  service available.
                </p>
                <p>If you already have a product key, you can apply it now.</p>
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTrialDialogOpen(false);
                    router.push(
                      `/auth/product-key?email=${encodeURIComponent(
                        authUser?.email || "",
                      )}`,
                    );
                  }}
                >
                  Enter product key
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Notifications Sidebar - Right */}
          {notificationsOpen && (
            <>
              {/* Desktop sidebar */}
              <div className="hidden md:fixed md:right-0 md:top-16 md:h-[calc(100vh-64px)] md:w-[28rem] md:border-l md:border-border md:bg-background md:flex md:flex-col md:z-40 md:shadow-2xl">
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-bold flex-1 text-foreground">
                      Notifications
                    </h2>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                        onClick={clearAllNotifications}
                        aria-label="Clear all notifications"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="p-1 hover:bg-secondary rounded-lg"
                      aria-label="Close notifications"
                    >
                      <X className="w-4 h-4 text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto space-y-3 p-4">
                  {notifications.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      No notifications
                    </p>
                  ) : (
                    [...notifications]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt || b.date).getTime() -
                          new Date(a.createdAt || a.date).getTime(),
                      )
                      .map((notif, index) => (
                        <Link
                          key={notif.id || index}
                          href={notif?.actionUrl?.toString() || "#"}
                          onClick={async () => {
                            if (!notif.read) {
                              try {
                                await markNotificationRead(
                                  notif.id,
                                  token ?? undefined,
                                );
                              } catch (e) {
                                console.error("markNotificationRead failed", e);
                              }
                              setNotifications((prev) =>
                                prev.map((n) =>
                                  n.id === notif.id ? { ...n, read: true } : n,
                                ),
                              );
                            }
                            setNotificationsOpen(false);
                          }}
                        >
                          <Card
                            className={`rounded-3xl p-4 cursor-pointer hover:bg-secondary transition-colors border ${
                              notif.read
                                ? "border-border bg-card"
                                : "border-primary bg-primary/5"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {!notif.read && (
                                  <div className="w-2 h-2 bg-primary rounded-full" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    {React.createElement(
                                      getNotificationIcon(
                                        notif.category,
                                        notif.type,
                                      ),
                                      {
                                        className: "w-5 h-5",
                                      },
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-semibold text-sm text-foreground truncate">
                                        {notif.title}
                                      </p>
                                      <Badge className="text-xs whitespace-nowrap">
                                        {notif.category || notif.type}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                      {notif.body ||
                                        notif.message ||
                                        "No details available."}
                                    </p>
                                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                      <span>
                                        {new Date(
                                          notif.createdAt || notif.date,
                                        ).toLocaleDateString()}
                                      </span>
                                      {notif.resourceType && (
                                        <span className="rounded-full bg-secondary/10 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-secondary">
                                          {notif.resourceType}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                            </div>
                          </Card>
                        </Link>
                      ))
                  )}
                </div>
              </div>

              {/* Mobile overlay */}
              <div className="md:hidden fixed right-0 top-16 h-[calc(100vh-64px)] z-40 w-full sm:w-96 bg-background border-l border-border shadow-lg overflow-y-auto">
                <div className="p-4 border-b border-border sticky top-0 bg-background">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-foreground">Notifications</h2>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="p-1 hover:bg-secondary rounded-lg"
                      aria-label="Close notifications"
                    >
                      <X className="w-4 h-4 text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-2 p-4">
                  {notifications.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      No notifications
                    </p>
                  ) : (
                    notifications.map((notif, index) => (
                      <Link
                        key={notif.id || index}
                        href={notif?.actionUrl?.toString() || "#"}
                        onClick={async () => {
                          if (!notif.read) {
                            try {
                              await markNotificationRead(
                                notif.id,
                                token ?? undefined,
                              );
                            } catch (e) {
                              console.error("markNotificationRead failed", e);
                            }
                            setNotifications((prev) =>
                              prev.map((n) =>
                                n.id === notif.id ? { ...n, read: true } : n,
                              ),
                            );
                          }
                          setNotificationsOpen(false);
                        }}
                      >
                        <Card
                          className={`rounded-3xl p-4 cursor-pointer hover:bg-secondary transition-colors border ${
                            notif.read
                              ? "border-border bg-card"
                              : "border-primary bg-primary/5"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {!notif.read && (
                                <div className="w-2 h-2 bg-primary rounded-full" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                  {React.createElement(
                                    getNotificationIcon(
                                      notif.category,
                                      notif.type,
                                    ),
                                    {
                                      className: "w-5 h-5",
                                    },
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-sm text-foreground truncate">
                                      {notif.title}
                                    </p>
                                    <Badge className="text-xs whitespace-nowrap">
                                      {notif.category || notif.type}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                    {notif.body ||
                                      notif.message ||
                                      "No details available."}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span>
                                      {new Date(
                                        notif.date,
                                      ).toLocaleDateString()}
                                    </span>
                                    {notif.resourceType && (
                                      <span className="rounded-full bg-secondary/10 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-secondary">
                                        {notif.resourceType}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-black/20 z-30"
                onClick={() => setNotificationsOpen(false)}
              />
            </>
          )}
        </div>
      </Suspense>
    </div>
  );
}
