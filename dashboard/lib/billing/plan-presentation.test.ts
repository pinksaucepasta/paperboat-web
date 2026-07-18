import { describe, expect, it } from "vitest";

import { getPlanPresentation } from "./plan-presentation";

describe("getPlanPresentation", () => {
  it("parses configured plan card content", () => {
    expect(
      getPlanPresentation({
        metadata: {
          presentation: {
            price_monthly_usd: 60,
            tagline: "For daily drivers",
            features: [
              { label: "Up to 20 active projects", icon: "projects" },
              42,
              "Priority support",
            ],
            most_popular: true,
          },
        },
      }),
    ).toEqual({
      priceMonthlyUsd: 60,
      tagline: "For daily drivers",
      features: [
        { label: "Up to 20 active projects", icon: "projects" },
        { label: "Priority support", icon: "feature" },
      ],
      mostPopular: true,
    });
  });

  it("returns null when presentation pricing is missing", () => {
    expect(getPlanPresentation({ metadata: null })).toBeNull();
    expect(
      getPlanPresentation({ metadata: { presentation: { tagline: "No price" } } }),
    ).toBeNull();
  });
});
