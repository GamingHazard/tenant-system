"use client";

import React from "react";
import { format, differenceInDays, startOfDay } from "date-fns";

interface Props {
  tenant: any;
  onRenew?: () => void;
}

export default function LeaseEndDisplay({ tenant, onRenew }: Props) {
  const explicit = tenant?.leaseEndDate;
  const leaseEnd = explicit
    ? new Date(explicit)
    : tenant?.leaseStartDate
      ? ((): Date => {
          const start = new Date(tenant.leaseStartDate);
          const leaseType = tenant?.leaseType || "month-to-month";
          let months = 1;
          switch (leaseType) {
            case "monthly":
            case "month-to-month":
              months = 1;
              break;
            case "3_months":
            case "3-months":
            case "3 months":
              months = 3;
              break;
            case "half_year":
            case "half-year":
            case "6_months":
            case "6-months":
              months = 6;
              break;
            case "full_year":
            case "full-year":
            case "12_months":
            case "12-months":
              months = 12;
              break;
            default:
              const parsed = parseInt(
                String(leaseType).replace(/[^0-9]/g, ""),
                10,
              );
              if (!Number.isNaN(parsed) && parsed > 0) months = parsed;
          }
          const d = new Date(start);
          d.setMonth(d.getMonth() + months);
          return d;
        })()
      : null;

  if (!leaseEnd) {
    return <span className="text-sm text-muted-foreground">Not set</span>;
  }

  const days = differenceInDays(startOfDay(leaseEnd), startOfDay(new Date()));

  let toneClass = "bg-green-100 text-green-700";
  let badgeText = `${days} days left`;
  if (days <= 0) {
    toneClass = "bg-red-100 text-red-700";
    badgeText = days === 0 ? `Expires today` : `Expired ${Math.abs(days)}d ago`;
  } else if (days <= 30) {
    toneClass = "bg-orange-100 text-orange-700";
    badgeText = `${days} days left`;
  }

  const sourceNote = explicit
    ? "Set by admin"
    : "Calculated from lease start & type";

  return (
    <div aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">
          {format(leaseEnd, "MMM d, yyyy")}
        </div>
        <div
          role="status"
          aria-label={`Lease status: ${badgeText}`}
          className={`px-2 py-1 rounded text-xs font-medium ${toneClass}`}
        >
          {badgeText}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
        <span>{sourceNote}</span>
        {onRenew && (
          <button onClick={onRenew} className="text-primary underline text-xs">
            Renew / Contact
          </button>
        )}
      </div>
    </div>
  );
}
