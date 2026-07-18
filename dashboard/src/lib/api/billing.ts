import { pbFetch } from "./client";
import type {
  BillingPlanProduct,
  CheckoutSession,
  Entitlement,
  Usage,
  StorageSubscription,
  StorageChangePreview,
  AutoTopupPolicy,
} from "./types";

export function getEntitlement(): Promise<Entitlement> {
  return pbFetch<Entitlement>("/api/billing/entitlement");
}

export function getStorageSubscription(): Promise<StorageSubscription> {
  return pbFetch<StorageSubscription>("/api/billing/storage");
}

export function updateStorageSubscription(storageGb: number): Promise<StorageSubscription> {
  return pbFetch<StorageSubscription>("/api/billing/storage", {
    method: "PUT",
    body: { storage_gb: storageGb },
  });
}

export function previewStorageSubscription(storageGb: number): Promise<StorageChangePreview> {
  return pbFetch<StorageChangePreview>(`/api/billing/storage-preview?storage_gb=${encodeURIComponent(storageGb)}`);
}

export function getAutoTopupPolicy(): Promise<AutoTopupPolicy> {
  return pbFetch<AutoTopupPolicy>("/api/billing/auto-topup");
}

export function updateAutoTopupPolicy(policy: AutoTopupPolicy): Promise<AutoTopupPolicy> {
  return pbFetch<AutoTopupPolicy>("/api/billing/auto-topup", { method: "PUT", body: policy });
}

export function getUsage(): Promise<Usage> {
  return pbFetch<Usage>("/api/billing/usage");
}

export function listBillingPlanProducts(): Promise<BillingPlanProduct[]> {
  return pbFetch<BillingPlanProduct[]>("/api/billing/plan-products");
}

/** Start a Polar checkout; returns the hosted checkout URL to redirect to. */
export function createCheckout(
  productCode: string,
  successUrl: string,
): Promise<CheckoutSession> {
  return pbFetch<CheckoutSession>("/api/billing/checkout", {
    method: "POST",
    body: { product_code: productCode, success_url: successUrl },
  });
}

/** Open the Polar customer portal; returns the hosted portal URL. */
export function createCustomerPortal(returnUrl: string): Promise<CheckoutSession> {
  return pbFetch<CheckoutSession>("/api/billing/customer-portal", {
    method: "POST",
    body: { return_url: returnUrl },
  });
}
