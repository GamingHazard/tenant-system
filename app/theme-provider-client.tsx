'use client'

import * as React from "react";
import { ThemeProvider } from "@/components/theme-provider";

export default function ThemeProviderClient({
  children,
  ...props
}: React.ComponentProps<typeof ThemeProvider>) {
  return <ThemeProvider {...props}>{children}</ThemeProvider>;
}
