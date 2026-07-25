"use client";

import * as React from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Coins01Icon,
  CreditCardIcon,
  CustomerSupportIcon,
  Database01Icon,
  EarthIcon,
  Folder01Icon,
  InformationCircleIcon,
  Link01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  createCheckout,
  getEntitlement,
  listBillingPlanProducts,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import type { BillingPlanProduct, Entitlement } from "@/lib/api/types";
import { useApi } from "@/lib/api/use-api";
import {
  getPlanFeatures,
  getPlanPresentation,
  getTrialPlanDetails,
  type PlanFeatureIcon,
} from "@/lib/billing/plan-presentation";
import { formatCredits } from "@/lib/format";

const PROMPT_STORAGE_PREFIX = "paperboat:trial-prompt:dismissed:";

const FEATURE_ICONS = {
  credits: Coins01Icon,
  storage: Database01Icon,
  projects: Folder01Icon,
  regions: EarthIcon,
  environment_access: Link01Icon,
  support: CustomerSupportIcon,
  feature: InformationCircleIcon,
} satisfies Record<PlanFeatureIcon, typeof Coins01Icon>;

export function trialPromptStorageKey(userId: string): string {
  return PROMPT_STORAGE_PREFIX + userId;
}

function hasDismissedPrompt(userId: string): boolean {
  try {
    return window.localStorage.getItem(trialPromptStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function rememberPromptDismissal(userId: string): void {
  try {
    window.localStorage.setItem(trialPromptStorageKey(userId), "true");
  } catch {
    // The dialog still stays dismissed for this page when storage is unavailable.
  }
}

export function findTrialOffer(plans: BillingPlanProduct[]) {
  for (const plan of plans) {
    const details = getTrialPlanDetails(plan);
    if (!details) continue;
    const convertsTo = plans.find(
      (candidate) => candidate.plan_code === details.convertsToPlanCode,
    );
    return { plan, details, convertsTo };
  }
  return null;
}

export type TrialOffer = NonNullable<ReturnType<typeof findTrialOffer>>;

export interface TrialCheckoutTerms {
  days: number;
  conversionName: string;
  conversionPrice: number;
}

/**
 * Checkout is only safe once every user-visible trial term is available from
 * the dynamic catalog. The server remains the authority for eligibility.
 */
export function getTrialCheckoutTerms(
  offer: TrialOffer,
): TrialCheckoutTerms | null {
  const days = offer.details.days;
  const conversionPlan = offer.convertsTo;
  if (days === null || !conversionPlan) return null;

  const conversionName = conversionPlan.plan_name.trim();
  const conversionPresentation = getPlanPresentation(conversionPlan);
  if (!conversionName || !conversionPresentation) return null;

  return {
    days,
    conversionName,
    conversionPrice: conversionPresentation.priceMonthlyUsd,
  };
}

interface TrialPromptDialogProps {
  offer: TrialOffer;
  open: boolean;
  checkingOut: boolean;
  onDismiss: () => void;
  onStart: () => void;
}

export function TrialPrompt({ userId }: { userId: string }) {
  const entitlement = useApi<Entitlement>(getEntitlement);
  const planProducts = useApi<BillingPlanProduct[]>(listBillingPlanProducts);
  const [open, setOpen] = React.useState(false);
  const [checkingOut, setCheckingOut] = React.useState(false);

  const offer = findTrialOffer(planProducts.data ?? []);
  const offerCode = offer?.plan.code;

  React.useEffect(() => {
    if (
      !entitlement.data?.trial_eligible ||
      !offerCode ||
      hasDismissedPrompt(userId)
    ) {
      return;
    }
    // This synchronizes the dialog with browser-persisted onboarding state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [entitlement.data?.trial_eligible, offerCode, userId]);

  function dismiss() {
    rememberPromptDismissal(userId);
    setOpen(false);
  }

  async function startTrial() {
    if (!offer || !getTrialCheckoutTerms(offer)) return;
    setCheckingOut(true);
    try {
      const successUrl = new URL("/dashboard/billing", window.location.origin);
      successUrl.searchParams.set("checkout", "success");
      successUrl.searchParams.set("plan", offer.plan.plan_code);
      const { url } = await createCheckout(offer.plan.code, successUrl.toString());
      rememberPromptDismissal(userId);
      window.location.assign(url);
    } catch (error) {
      toast.error("Couldn't start the free trial.", {
        description:
          error instanceof ApiError ? error.message : "Something went wrong.",
      });
      setCheckingOut(false);
    }
  }

  if (!offer || !entitlement.data?.trial_eligible) return null;

  return (
    <TrialPromptDialog
      offer={offer}
      open={open}
      checkingOut={checkingOut}
      onDismiss={dismiss}
      onStart={startTrial}
    />
  );
}

export function TrialPromptDialog({
  offer,
  open,
  checkingOut,
  onDismiss,
  onStart,
}: TrialPromptDialogProps) {
  const presentation = getPlanPresentation(offer.plan);
  const features = getPlanFeatures(offer.plan);
  const checkoutTerms = getTrialCheckoutTerms(offer);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !checkingOut) onDismiss();
      }}
    >
      <DialogContent className="gap-6 p-6 sm:max-w-md">
        <DialogHeader className="gap-2 pr-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HugeiconsIcon icon={CreditCardIcon} className="size-5" />
          </div>
          <DialogTitle className="font-heading text-xl font-semibold">
            {checkoutTerms
              ? `Start your ${checkoutTerms.days}-day free trial`
              : "Trial terms unavailable"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {checkoutTerms
              ? presentation?.tagline ||
                "Review the included resources and billing terms before checkout."
              : "Checkout is disabled until this trial has a duration, conversion plan, and price."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 border-y border-border py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <HugeiconsIcon icon={Coins01Icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="break-words font-medium tabular-nums">
                  {formatCredits(offer.plan.included_credits)} credits
                </p>
                <p className="text-xs text-muted-foreground">Included</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <HugeiconsIcon icon={Database01Icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="break-words font-medium tabular-nums">
                  {offer.plan.included_storage_gb} GB
                </p>
                <p className="text-xs text-muted-foreground">Storage</p>
              </div>
            </div>
          </div>

          {features.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Included with your trial</p>
              <ul className="flex flex-col gap-2">
                {features.map((feature) => (
                  <li
                    key={`${feature.icon}-${feature.label}`}
                    className="flex min-w-0 items-start gap-2 text-sm"
                  >
                    <HugeiconsIcon
                      icon={FEATURE_ICONS[feature.icon]}
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    <span className="min-w-0 break-words leading-5">
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {checkoutTerms ? (
          <p className="text-xs leading-5 text-muted-foreground">
            After {checkoutTerms.days} days, the trial converts to {checkoutTerms.conversionName}
            {` at $${checkoutTerms.conversionPrice}/month`} unless canceled. Billing
            details are handled securely by Polar.
          </p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground" role="status">
            Complete trial terms are unavailable, so checkout cannot be started.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={onDismiss}
            disabled={checkingOut}
          >
            Not now
          </Button>
          <Button
            size="lg"
            onClick={onStart}
            disabled={checkingOut || !checkoutTerms}
          >
            {checkingOut ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-start" />
            )}
            {checkoutTerms ? "Continue" : "Terms unavailable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
