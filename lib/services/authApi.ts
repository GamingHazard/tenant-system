/**
 * Authentication API Client
 * Handles all API calls to the backend auth endpoints
 */

import { getErrorMessage } from "@/lib/utils";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5454/api";

function createApiError(data: unknown, fallback: string): Error {
  return new Error(getErrorMessage(data, fallback));
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface SignupSendCodeRequest {
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "property_manager";
  password: string;
  acceptedTermsAndConditions: boolean;
}

export interface SignupVerifyCodeRequest {
  email: string;
  code: string;
}

export interface TenantSummary {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  unitNumber?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  status?: string;
  propertyId?: string;
}

export interface AssignedProperty {
  id?: string;
  name?: string;
  city?: string;
  address?: string;
  tenants?: TenantSummary[];
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      status: string;
      emailVerified: boolean;
      isActivated?: boolean;
      trialStartAt?: string;
      trialExpiryAt?: string;
      trialDaysRemaining?: number | null;
      trialExpired?: boolean;
      createdAt: string;
      settingsId?: string;
      propertyId?: string;
      assignedProperty?: AssignedProperty;
    };
    token: string;
  };
  message: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  isActivated?: boolean;
  trialStartAt?: string;
  trialExpiryAt?: string;
  trialDaysRemaining?: number | null;
  trialExpired?: boolean;
  createdAt: string;
  settingsId?: string;
  propertyId?: string;
  assignedProperty?: AssignedProperty;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Register new user
 */
export async function register(
  payload: RegisterRequest,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Registration failed");
  }

  return data;
}

/**
 * Login user
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Login failed");
  }

  return data;
}

export async function signupSendCode(
  payload: SignupSendCodeRequest,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/signup-send-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(
      data?.error || data,
      "Failed to send signup verification code",
    );
  }

  return data;
}

export async function verifySignupCode(
  payload: SignupVerifyCodeRequest,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-signup-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to verify signup code");
  }

  return data;
}

/**
 * Verify email token
 */
export async function verifyEmail(
  token: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Email verification failed");
  }

  return data;
}

/**
 * Verify product/license key for a user
 */
export async function verifyProductKey(
  email: string,
  key: string,
): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-product-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, productKey: key }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(
      data?.error || data,
      "Product key verification failed",
    );
  }

  return data;
}

export async function startTrial(
  email: string,
): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await fetch(`${API_BASE_URL}/auth/start-trial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to start trial");
  }

  return data;
}

/**
 * Get current user profile
 */
export async function getCurrentUser(
  token: string,
): Promise<{ success: boolean; data: { user: User } }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to fetch user");
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateProfile(
  token: string,
  payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    profile?: {
      company?: string;
      department?: string;
      title?: string;
      bio?: string;
    };
  },
): Promise<{ success: boolean; data: { user: User } }> {
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to update profile");
  }

  return data;
}

/**
 * Change password
 */
export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to change password");
  }

  return data;
}

/**
 * Request password reset
 */
export async function forgotPassword(
  email: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(
      data?.error || data,
      "Failed to request password reset",
    );
  }

  return data;
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password: newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to reset password");
  }

  return data;
}

/**
 * Verify password reset code
 */
export async function verifyResetCode(
  email: string,
  code: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-reset-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to verify code");
  }

  return data;
}

/**
 * Set new password after code verification
 */
export async function setNewPassword(
  email: string,
  code: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/set-new-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to set new password");
  }

  return data;
}

/**
 * Admin: Create new user
 */
export async function createAdminUser(
  token: string,
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: "admin" | "property_manager";
  },
): Promise<{
  success: boolean;
  data: {
    user: User;
    temporaryPassword: string;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/create-user`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to create user");
  }

  return data;
}

/**
 * Admin: List all users
 */
export async function listUsers(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
  },
): Promise<{
  success: boolean;
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append("page", String(options.page));
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.role) params.append("role", options.role);
  if (options?.status) params.append("status", options.status);

  const response = await fetch(`${API_BASE_URL}/auth/admin/users?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to fetch users");
  }

  return data;
}

/**
 * Admin: Update user
 */
export async function updateUser(
  token: string,
  userId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
  },
): Promise<{ success: boolean; data: { user: User } }> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to update user");
  }

  return data;
}

/**
 * Admin: Delete user
 */
export async function deleteUser(
  token: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(data?.error || data, "Failed to delete user");
  }

  return data;
}
