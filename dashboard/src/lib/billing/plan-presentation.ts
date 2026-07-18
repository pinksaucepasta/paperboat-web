/**
 * Parses the `presentation` block of a billing plan product's metadata, as
 * returned by `/api/billing/plan-products`. The values are authored in the
 * paperboat-server catalog seed (plan metadata) — the dashboard only renders
 * them. Plans without a presentation block fall back to data-derived content.
 */
interface HasPlanMetadata {
  metadata: Record<string, unknown> | null;
}

export interface PlanPresentation {
  /** Monthly price in USD, as shown on the card. */
  priceMonthlyUsd: number;
  /** Short line shown under the plan name. */
  tagline: string;
  /** Feature bullets shown after the credits/storage lines, in display order. */
  features: PlanFeature[];
  /** Marks the card highlighted with the "Most Popular" treatment. */
  mostPopular: boolean;
}

export interface TrialPlanDetails {
  /** Optional display duration. Trial eligibility is defined by the conversion target. */
  days: number | null;
  convertsToPlanCode: string;
}

export type PlanFeatureIcon =
  | "credits"
  | "storage"
  | "projects"
  | "regions"
  | "agentunnel"
  | "support"
  | "feature";

export interface PlanFeature {
  label: string;
  icon: PlanFeatureIcon;
}

const FEATURE_ICONS = new Set<PlanFeatureIcon>([
  "credits",
  "storage",
  "projects",
  "regions",
  "agentunnel",
  "support",
  "feature",
]);

function parseFeature(value: unknown): PlanFeature | null {
  if (typeof value === "string") return { label: value, icon: "feature" };
  if (typeof value !== "object" || value === null) return null;
  const feature = value as Record<string, unknown>;
  if (typeof feature.label !== "string") return null;
  const icon =
    typeof feature.icon === "string" &&
    FEATURE_ICONS.has(feature.icon as PlanFeatureIcon)
      ? (feature.icon as PlanFeatureIcon)
      : "feature";
  return { label: feature.label, icon };
}

/** Reads configured plan entitlements without requiring a presentational price. */
export function getPlanFeatures(plan: HasPlanMetadata): PlanFeature[] {
  const presentation = plan.metadata?.presentation;
  if (typeof presentation !== "object" || presentation === null) return [];

  const value = presentation as Record<string, unknown>;
  return Array.isArray(value.features)
    ? value.features.map(parseFeature).filter((f): f is PlanFeature => f !== null)
    : [];
}

export function getPlanPresentation(
  plan: HasPlanMetadata,
): PlanPresentation | null {
  const presentation = plan.metadata?.presentation;
  if (typeof presentation !== "object" || presentation === null) return null;
  const p = presentation as Record<string, unknown>;
  const rawPrice = p.price_monthly_usd;
  if (
    (typeof rawPrice !== "number" && typeof rawPrice !== "string") ||
    (typeof rawPrice === "string" && rawPrice.trim() === "")
  ) {
    return null;
  }
  const price = Number(rawPrice);
  if (!Number.isFinite(price) || price < 0) return null;
  return {
    priceMonthlyUsd: price,
    tagline: typeof p.tagline === "string" ? p.tagline : "",
    features: getPlanFeatures(plan),
    mostPopular: p.most_popular === true,
  };
}

/** Reads trial behavior from the server-owned plan catalog metadata. */
export function getTrialPlanDetails(
  plan: HasPlanMetadata,
): TrialPlanDetails | null {
  const billing = plan.metadata?.billing;
  if (typeof billing !== "object" || billing === null) return null;

  const value = billing as Record<string, unknown>;
  const parsedDays = Number(value.trial_days);
  const days =
    Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : null;
  const convertsToPlanCode =
    typeof value.converts_to_plan === "string"
      ? value.converts_to_plan
      : "";

  if (!convertsToPlanCode) return null;
  return { days, convertsToPlanCode };
}
