export type LoyaltyTier = "none" | "silver" | "gold" | "platinum";

const DISCOUNTS: Record<LoyaltyTier, number> = {
  none: 0,
  silver: 0.03,
  gold: 0.07,
  platinum: 0.1,
};

export interface TravelerProfile {
  travelerId: string;
  tier: LoyaltyTier;
}

export function discountRate(profile: TravelerProfile): number {
  return DISCOUNTS[profile.tier] ?? 0;
}
