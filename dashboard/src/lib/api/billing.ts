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
  return pbFetch<Entitlement>("/v1/billing/entitlement");
}

export function getStorageSubscription(): Promise<StorageSubscription> {
  return pbFetch<StorageSubscription>("/v1/billing/storage");
}

export function updateStorageSubscription(storageGb: number): Promise<StorageSubscription> {
  return pbFetch<StorageSubscription>("/v1/billing/storage", {
    method: "PUT",
    body: { storage_gb: storageGb },
  });
}

export function previewStorageSubscription(storageGb: number): Promise<StorageChangePreview> {
  return pbFetch<StorageChangePreview>(`/v1/billing/storage-change-preview?storage_gb=${encodeURIComponent(storageGb)}`);
}

export function getAutoTopupPolicy(): Promise<AutoTopupPolicy> {
  return pbFetch<AutoTopupPolicy>("/v1/billing/auto-topup");
}

export function updateAutoTopupPolicy(policy: AutoTopupPolicy): Promise<AutoTopupPolicy> {
  return pbFetch<AutoTopupPolicy>("/v1/billing/auto-topup", { method: "PUT", body: policy });
}

export function getUsage(): Promise<Usage> {
  return pbFetch<Usage>("/v1/billing/usage");
}

export function listBillingPlanProducts(): Promise<BillingPlanProduct[]> {
  return pbFetch<BillingPlanProduct[]>("/v1/billing/plan-products");
}

/** Start a Polar checkout; returns the hosted checkout URL to redirect to. */
export function createCheckout(
  productCode: string,
  successUrl: string,
): Promise<CheckoutSession> {
  return pbFetch<CheckoutSession>("/v1/billing/checkout", {
    method: "POST",
    body: { product_code: productCode, success_url: successUrl },
  });
}

/** Open the Polar customer portal; returns the hosted portal URL. */
export function createCustomerPortal(returnUrl: string): Promise<CheckoutSession> {
  return pbFetch<CheckoutSession>("/v1/billing/customer-portal", {
    method: "POST",
    body: { return_url: returnUrl },
  });
}
