"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Coins01Icon,
  CreditCardIcon,
  CustomerSupportIcon,
  DatabaseIcon,
  EarthIcon,
  Folder01Icon,
  InformationCircleIcon,
  Link01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useApi } from "@/lib/api/use-api";
import { ApiError } from "@/lib/api/client";
import {
  createCheckout,
  getEntitlement,
  createCustomerPortal,
  getStorageSubscription,
  updateStorageSubscription,
  previewStorageSubscription,
  getAutoTopupPolicy,
  updateAutoTopupPolicy,
  listBillingPlanProducts,
} from "@/lib/api/billing";
import { Input } from "@/components/ui/input";
import type { AutoTopupPolicy, BillingPlanProduct, Entitlement, StorageChangePreview, StorageSubscription } from "@/lib/api/types";
import { formatCredits } from "@/lib/format";
import {
  getPlanPresentation,
  type PlanFeature,
  type PlanFeatureIcon,
} from "@/lib/billing/plan-presentation";
import { cn } from "@/lib/utils";

function formatPeriod(e: Entitlement): string | null {
  if (!e.current_period_end) return null;
  const end = new Date(e.current_period_end).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return e.state === "trialing" ? `Trial ends ${end}` : `Renews ${end}`;
}

const FEATURE_ICONS = {
  credits: Coins01Icon,
  storage: DatabaseIcon,
  projects: Folder01Icon,
  regions: EarthIcon,
  agentunnel: Link01Icon,
  support: CustomerSupportIcon,
  feature: InformationCircleIcon,
} satisfies Record<PlanFeatureIcon, typeof Coins01Icon>;

function FeatureLabel({ children }: { children: string }) {
  return children.split(/(\d[\d,.]*)/g).map((part, index) =>
    /^\d/.test(part) ? (
      <strong
        key={`${part}-${index}`}
        className="font-semibold tabular-nums text-foreground"
      >
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function isTrialPlan(plan: BillingPlanProduct) {
  const billing = plan.metadata?.billing;
  return Boolean(billing && typeof billing === "object" && "converts_to_plan" in billing);
}

export default function BillingPage() {
  const entitlement = useApi<Entitlement>(getEntitlement);
  const refreshEntitlement = entitlement.refresh;
  const { data, error, loading } = entitlement;
  const searchParams = useSearchParams();
  const planProducts = useApi<BillingPlanProduct[]>(listBillingPlanProducts);
  const storage = useApi<StorageSubscription>(getStorageSubscription);
  const autoTopup = useApi<AutoTopupPolicy>(getAutoTopupPolicy);
  const [opening, setOpening] = React.useState(false);
  const [changingPlan, setChangingPlan] = React.useState<string | null>(null);
  const [checkingOut, setCheckingOut] = React.useState<string | null>(null);
  const [storageGB, setStorageGB] = React.useState<number | null>(null);
  const [threshold, setThreshold] = React.useState<string | null>(null);
  const [bundleCredits, setBundleCredits] = React.useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = React.useState<boolean | null>(null);
  const [savingAddons, setSavingAddons] = React.useState(false);
  const [storagePreview, setStoragePreview] = React.useState<StorageChangePreview | null>(null);
  const isTrial = data?.state === "trialing";
  const canOpenPortal = Boolean(data?.active);

  const effectiveStorageGB = storageGB ?? storage.data?.current_gb ?? null;
  const effectiveThreshold = threshold ?? autoTopup.data?.threshold ?? "";
  const effectiveBundleCredits = bundleCredits ?? autoTopup.data?.bundle_credits ?? "";
  const effectiveAutoEnabled = autoEnabled ?? autoTopup.data?.enabled ?? false;

  async function reviewAddons() {
    if (effectiveStorageGB === null) return;
    setSavingAddons(true);
    try { setStoragePreview(await previewStorageSubscription(effectiveStorageGB)); }
    catch (err) { toast.error("Couldn't calculate the storage change.", { description: err instanceof ApiError ? err.message : "Something went wrong." }); }
    finally { setSavingAddons(false); }
  }

  async function saveAddons() {
    setSavingAddons(true);
    try {
      if (effectiveStorageGB !== null) await updateStorageSubscription(effectiveStorageGB);
      await updateAutoTopupPolicy({ enabled: effectiveAutoEnabled, threshold: effectiveThreshold, bundle_credits: effectiveBundleCredits });
      await Promise.all([storage.refresh(), autoTopup.refresh()]);
      setStoragePreview(null);
      setStorageGB(null); setThreshold(null); setBundleCredits(null); setAutoEnabled(null);
      toast.success("Billing add-ons updated.");
    } catch (err) {
      toast.error("Couldn't update billing add-ons.", { description: err instanceof ApiError ? err.message : "Something went wrong." });
    } finally { setSavingAddons(false); }
  }

  function money(minor: number, currency: string) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  }

  React.useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      void refreshEntitlement();
      if (attempts >= 5) window.clearInterval(interval);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [refreshEntitlement, searchParams]);
  const plans = React.useMemo(() => {
    return (planProducts.data ?? []).filter((plan) => !isTrialPlan(plan) || data?.trial_eligible || data?.plan_code === plan.plan_code).map((plan) => ({
      ...plan,
      product_code: plan.code,
    })).sort(
      (a, b) => Number(a.included_credits) - Number(b.included_credits),
    );
  }, [planProducts.data, data?.plan_code, data?.trial_eligible]);

  async function openPortal(planCode: string | null = null) {
    if (!canOpenPortal) {
      toast.error("A subscription is required.", {
        description: "Choose a plan or trial before opening the billing portal.",
      });
      return;
    }
    setChangingPlan(planCode);
    setOpening(true);
    try {
      const { url } = await createCustomerPortal(window.location.href);
      window.location.assign(url);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error("Couldn't open the billing portal.", { description: message });
      setOpening(false);
      setChangingPlan(null);
    }
  }

  async function startCheckout(productCode: string) {
    setCheckingOut(productCode);
    try {
      const successUrl = new URL("/dashboard/billing", window.location.origin);
      successUrl.searchParams.set("checkout", "success");
      const { url } = await createCheckout(productCode, successUrl.toString());
      window.location.assign(url);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error("Couldn't start checkout.", { description: message });
      setCheckingOut(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Billing"
        description="Change plans with clear proration, or manage payment details through the billing portal."
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : error ? (
        <Empty className="min-h-[16rem] border">
          <EmptyHeader>
            <EmptyTitle className="font-heading">Couldn&apos;t load billing</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="plans-heading" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="plans-heading" className="font-heading text-base font-semibold">
                Plans
              </h2>
              <p className="text-sm text-muted-foreground">
                Compare credits, storage, project limits, region access, and support.
              </p>
            </div>

            {planProducts.loading ? (
              <div className="flex min-h-44 items-center justify-center rounded-lg border border-border">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : planProducts.error ? (
              <Empty className="min-h-44 border">
                <EmptyHeader>
                  <EmptyTitle className="font-heading">Couldn&apos;t load plans</EmptyTitle>
                  <EmptyDescription>
                    {planProducts.error.message}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : plans.length === 0 ? (
              <Empty className="min-h-44 border">
                <EmptyHeader>
                  <EmptyTitle className="font-heading">No plans available</EmptyTitle>
                  <EmptyDescription>
                    Plan products are configured in the billing catalog.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4">
                {plans.map((plan) => {
                  const isCurrentPlan =
                    Boolean(data?.active) && data?.plan_code === plan.plan_code;
                  const changingThisPlan =
                    (opening && changingPlan === plan.product_code) ||
                    (checkingOut === plan.product_code && plan.product_code !== "");
                  const purchasable = plan.product_code !== "";
                  const presentation = getPlanPresentation(plan);
                  const isPopular = Boolean(presentation?.mostPopular);
                  const features: PlanFeature[] = [
                    {
                      label: `${formatCredits(plan.included_credits)} credits`,
                      icon: "credits",
                    },
                    {
                      label: `${plan.included_storage_gb} GB storage`,
                      icon: "storage",
                    },
                    ...(presentation?.features ?? []),
                  ];

                  return (
                    <Card
                      key={plan.code}
                      className={cn(
                        "gap-0 py-0",
                        isPopular
                          ? "rounded-xl shadow-md ring-2 ring-primary"
                          : "md:my-4",
                      )}
                    >
                      {isPopular ? (
                        <p className="bg-primary pb-3 pt-1 text-center font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground">
                          Most popular
                        </p>
                      ) : null}
                      <CardHeader
                        className={cn(
                          "border-b border-border p-6 pb-5",
                          isPopular && "-mt-2 bg-card pt-8",
                        )}
                      >
                        <CardTitle className="flex items-center justify-between gap-3 font-heading text-base font-semibold">
                          {plan.plan_name}
                          {isCurrentPlan ? (
                            <Badge variant="secondary">Current</Badge>
                          ) : null}
                        </CardTitle>
                        <CardDescription>
                          {presentation?.tagline ??
                            `${plan.included_storage_gb} GB storage included`}
                        </CardDescription>
                        <p className="pt-3 font-heading text-3xl font-semibold tabular-nums">
                          {presentation ? (
                            <>
                              ${presentation.priceMonthlyUsd}
                              <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
                                /mo
                              </span>
                            </>
                          ) : (
                            <>
                              {formatCredits(plan.included_credits)}
                              <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
                                credits
                              </span>
                            </>
                          )}
                        </p>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3 p-6">
                        <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          What&apos;s included
                        </p>
                        <ul className="flex flex-col gap-2">
                          {features.map((feature) => (
                            <li
                              key={`${feature.icon}-${feature.label}`}
                              className="flex items-start gap-2 text-sm"
                            >
                              <HugeiconsIcon
                                icon={FEATURE_ICONS[feature.icon]}
                                className="mt-0.5 size-4 shrink-0 text-primary"
                              />
                              <span>
                                <FeatureLabel>{feature.label}</FeatureLabel>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter className="p-6 pt-0">
                        <Button
                          variant={
                            isCurrentPlan
                              ? "secondary"
                              : isPopular
                                ? "default"
                                : "outline"
                          }
                          className="w-full"
                          onClick={() =>
                            plan.product_code
                              ? startCheckout(plan.product_code)
                              : openPortal(null)
                          }
                          disabled={
                            isCurrentPlan ||
                            opening ||
                            checkingOut !== null ||
                            (!purchasable && !canOpenPortal)
                          }
                        >
                          {checkingOut === plan.product_code ||
                          changingThisPlan ? (
                            <Spinner data-icon="inline-start" />
                          ) : null}
                          {isCurrentPlan
                            ? "Current plan"
                            : canOpenPortal
                              ? "Change plan"
                              : `Choose ${plan.plan_name}`}
                          {!isCurrentPlan &&
                          checkingOut !== plan.product_code &&
                          !changingThisPlan ? (
                            <HugeiconsIcon
                              icon={canOpenPortal ? CreditCardIcon : ArrowRight01Icon}
                              data-icon="inline-end"
                            />
                          ) : null}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {canOpenPortal ? (
            <section aria-labelledby="addons-heading" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="addons-heading" className="font-heading text-base font-semibold">Usage add-ons</h2>
                <p className="text-sm text-muted-foreground">Storage increases are prorated now; reductions apply at renewal. Credit top-ups use your saved payment method.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-base">Storage</CardTitle>
                    <CardDescription>{storage.data?.current_gb ?? 0} GB recurring storage{storage.data?.pending_gb !== undefined ? `, ${storage.data.pending_gb} GB pending` : ""}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <label htmlFor="billing-storage-gb" className="text-sm font-medium">Recurring storage (GB)</label>
                    <Input id="billing-storage-gb" type="number" min={0} step={storage.data?.unit_gb ?? 10} value={effectiveStorageGB ?? ""} onChange={(event) => { setStorageGB(Number(event.target.value)); setStoragePreview(null); }} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-base">Credit auto-top-up</CardTitle>
                    <CardDescription>Top up in configured 50-credit units when your balance is low.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={effectiveAutoEnabled} onChange={(event) => setAutoEnabled(event.target.checked)} /> Enable automatic top-up</label>
                    <label className="text-sm font-medium">Balance threshold<Input value={effectiveThreshold} onChange={(event) => setThreshold(event.target.value)} inputMode="decimal" className="mt-2" /></label>
                    <label className="text-sm font-medium">Bundle credits<Input value={effectiveBundleCredits} onChange={(event) => setBundleCredits(event.target.value)} inputMode="numeric" className="mt-2" /></label>
                    {autoTopup.data?.last_error ? <p className="text-sm text-destructive sm:col-span-2">The last automatic top-up failed. Check your payment method in the billing portal before retrying.</p> : null}
                  </CardContent>
                </Card>
              </div>
              {storagePreview ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{storagePreview.effective === "immediate" ? `${money(storagePreview.estimated_charge_minor, storagePreview.currency)} estimated charge now` : "Reduction scheduled for renewal"}</p>
                    <p className="text-muted-foreground">{money(storagePreview.next_renewal_total_minor, storagePreview.currency)} storage total at the next renewal. Taxes are calculated by Polar.</p>
                  </div>
                  <div className="flex gap-2"><Button variant="outline" onClick={() => setStoragePreview(null)} disabled={savingAddons}>Cancel</Button><Button onClick={saveAddons} disabled={savingAddons}>{savingAddons ? <Spinner data-icon="inline-start" /> : null}Confirm changes</Button></div>
                </div>
              ) : (
                <div><Button onClick={reviewAddons} disabled={savingAddons || storage.loading || autoTopup.loading}>{savingAddons ? <Spinner data-icon="inline-start" /> : null}Review changes</Button></div>
              )}
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle className="font-heading text-base font-semibold">
                    {data?.plan_name || data?.plan_code || "No active plan"}
                  </CardTitle>
                  <CardDescription>
                    {formatPeriod(data!) ?? "No billing period"}
                  </CardDescription>
                </div>
                <Badge
                  variant={data?.active ? "secondary" : "outline"}
                  className="capitalize"
                >
                  {data?.state ?? "inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {data?.active
                    ? isTrial
                      ? "Your trial is active and will convert to Sailor unless canceled before it ends."
                      : "Your plan is active. Manage changes, payment details, and invoices through the billing portal."
                    : "Choose a plan to start using Paperboat."}
                </p>
              </CardContent>
              {canOpenPortal ? (
                <CardFooter>
                  <Button
                    onClick={() => openPortal()}
                    disabled={opening || !canOpenPortal}
                  >
                    {opening && changingPlan === null ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <HugeiconsIcon icon={CreditCardIcon} data-icon="inline-start" />
                    )}
                    Open billing portal
                  </Button>
                </CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base font-semibold">
                  Payment
                </CardTitle>
                <CardDescription>Managed by our billing provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={CreditCardIcon} className="size-4" />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">
                      {canOpenPortal ? "Payment method on file" : "No payment method on file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {canOpenPortal
                        ? "Update it in the billing portal"
                        : "Choose a plan or trial to add billing details."}
                    </p>
                  </div>
                </div>
              </CardContent>
              {canOpenPortal ? (
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openPortal()}
                    disabled={opening || !canOpenPortal}
                  >
                    Manage payment
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
