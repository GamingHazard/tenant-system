"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings-context";

interface BankOption {
  code: string;
  name: string;
}

interface BankSelectorProps {
  value?: string;
  onChange: (code: string) => void;
  country?: string;
}

export default function BankSelector({
  value,
  onChange,
  country,
}: BankSelectorProps) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const { paystackBanks, isBanksLoaded, refreshBanks, settings } =
    useSettings();

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = `paystack-banks-listbox`;

  useEffect(() => {
    let cancelled = false;

    const countryKey = country ? String(country).trim().toLowerCase() : "all";

    const applyBanks = (source: any[]) => {
      const mapped = (source || []).map((b: any) => ({
        code: String(
          b.code || b.id || b.bank_code || b.bank_id || b.slug || b.name || "",
        ).trim(),
        name: b.name || String(b).slice(0, 40),
      }));
      setBanks(mapped as BankOption[]);
    };

    // Use context-provided banks if available
    if (Array.isArray(paystackBanks) && paystackBanks.length > 0) {
      applyBanks(paystackBanks);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    // Fallback to local cache and trigger refresh
    (async () => {
      setLoading(true);
      try {
        const cacheKey = `paystack_banks_${countryKey}`;
        try {
          if (typeof window !== "undefined") {
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (
                parsed?.ts &&
                Date.now() - parsed.ts < 24 * 60 * 60 * 1000 &&
                Array.isArray(parsed.data)
              ) {
                if (!cancelled) {
                  applyBanks(parsed.data);
                  setLoading(false);
                }
                return;
              }
            }
          }
        } catch (e) {
          // ignore storage errors
        }

        // Trigger provider refresh (best-effort)
        try {
          const countryParam = country || settings?.finance?.currency?.country;
          await refreshBanks(countryParam);
        } catch (e) {
          // ignore
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [country, paystackBanks, isBanksLoaded, refreshBanks, settings]);

  // filtered list based on query
  const filtered = banks.filter((b) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(b.name || "")
        .toLowerCase()
        .includes(q) ||
      String(b.code || "")
        .toLowerCase()
        .includes(q)
    );
  });

  useEffect(() => {
    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }, [query, filtered.length]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!inputRef.current) return;
      const target = e.target as Node;
      if (inputRef.current && !inputRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectIndex = (index: number) => {
    const item = filtered[index];
    if (item) {
      onChange(item.code);
      setQuery(item.name);
      setIsOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) selectIndex(highlightedIndex);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground mb-2">
        Bank
      </label>
      <div>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 && filtered[highlightedIndex]
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          aria-label="Search banks"
          placeholder={
            loading ? "Loading banks..." : "Search banks by name or code"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full px-3 py-2 mb-2 rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:bg-input dark:text-foreground"
          disabled={loading}
        />

        <div
          id={listboxId}
          role="listbox"
          aria-label="Bank options"
          className={`mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-sm dark:bg-popover dark:text-popover-foreground ${
            !isOpen || filtered.length === 0 ? "hidden" : ""
          }`}
        >
          {filtered.map((b, idx) => (
            <div
              id={`${listboxId}-option-${idx}`}
              key={b.code || idx}
              role="option"
              aria-selected={highlightedIndex === idx}
              onMouseDown={(ev) => {
                ev.preventDefault();
                selectIndex(idx);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2 cursor-pointer flex justify-between items-center ${
                highlightedIndex === idx
                  ? "bg-muted text-muted-foreground dark:bg-muted/80 dark:text-muted-foreground"
                  : "hover:bg-muted/50 dark:hover:bg-muted/70"
              }`}
            >
              <span className="truncate">{b.name}</span>
              <span className="text-xs text-muted-foreground dark:text-muted-foreground ml-3">
                {b.code}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground dark:text-muted-foreground">
              No banks found
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Select the bank (Paystack bank code)
      </p>
    </div>
  );
}
