import type {
  PaystackPopupInstance,
  PaystackPopupCallbacks,
} from "@paystack/inline-js";

interface PaystackPopupOptions {
  accessCode: string;
  publicKey?: string;
  onLoad?: (response: unknown) => void;
  onSuccess?: (transaction: unknown) => void;
  onCancel?: () => void;
  onError?: (error: Error | { message?: string }) => void;
}

export function openPaystackPopup({
  accessCode,
  publicKey,
  onLoad,
  onSuccess,
  onCancel,
  onError,
}: PaystackPopupOptions) {
  if (typeof window === "undefined") {
    throw new Error("Paystack popup can only be opened in the browser");
  }

  const Paystack = (
    window as Window & {
      PaystackPop?: new (args?: { key?: string }) => PaystackPopupInstance;
    }
  ).PaystackPop;

  if (!Paystack) {
    throw new Error("Paystack popup library is not available");
  }

  const popup = new Paystack({ key: publicKey });
  popup.resumeTransaction(accessCode, {
    onLoad: (response) => {
      if (onLoad) onLoad(response);
    },
    onSuccess: (transaction) => {
      if (onSuccess) onSuccess(transaction);
    },
    onCancel: () => {
      if (onCancel) onCancel();
    },
    onError: (error) => {
      if (onError) onError(error);
    },
  } as PaystackPopupCallbacks);
}
