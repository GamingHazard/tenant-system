"use client";

import React from "react";
import TenantForm from "./tenant-form";

interface AddTenantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export default function AddTenantForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  errorMessage = null,
}: AddTenantFormProps) {
  if (!isOpen) return null;

  return (
    <TenantForm
      mode="create"
      isOpen={isOpen}
      isLoading={isLoading}
      onClose={onClose}
      onSubmit={(formData) => {
        onSubmit?.(formData);
      }}
      errorMessage={errorMessage}
    />
  );
}
