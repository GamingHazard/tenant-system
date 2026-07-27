"use client";

import React from "react";
import { ThemeProvider } from "./theme-provider";
import type { ThemeProviderProps } from "next-themes";

export default function ThemeProviderClient({
  children,
  ...props
}: React.PropsWithChildren<ThemeProviderProps>) {
  return <ThemeProvider {...props}>{children}</ThemeProvider>;
}
