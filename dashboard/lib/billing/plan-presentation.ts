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

export function getPlanPresentation(
  plan: HasPlanMetadata,
): PlanPresentation | null {
  const presentation = plan.metadata?.presentation;
  if (typeof presentation !== "object" || presentation === null) return null;
  const p = presentation as Record<string, unknown>;
  const price = Number(p.price_monthly_usd);
  if (!Number.isFinite(price)) return null;
  return {
    priceMonthlyUsd: price,
    tagline: typeof p.tagline === "string" ? p.tagline : "",
    features: Array.isArray(p.features)
      ? p.features.map(parseFeature).filter((f): f is PlanFeature => f !== null)
      : [],
    mostPopular: p.most_popular === true,
  };
}
