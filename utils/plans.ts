import { allPlans } from "../types/shopify";
import { PLAN } from "types/enums";
export function getPlanName(plan: PLAN) {
  return allPlans.find((p) => p.plan === plan).name;
}

/**
 * @returns Returns plan limits and 0 if unlimited.
 */
export function getPlanLimits(plan: PLAN) {
  return allPlans.find((p) => p.plan === plan).syncLimit;
}
