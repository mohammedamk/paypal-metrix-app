import Shopify from "shopify-api-node";
import { PLAN } from "./enums";

export type PlanConfig = {
  plan: PLAN;
  name: string;
  price: number;
  syncLimit: number;
};

export const allPlans: PlanConfig[] = [
  {
    plan: "FREE",
    name: "Free Plan",
    price: 0.01,
    syncLimit: 30
  },
  {
    plan: "MICRO",
    name: "Micro Plan",
    price: 9.99,
    syncLimit: 100,
  },
  {
    plan: "DISCOVERY",
    name: "Discovery Plan",
    price: 29.99,
    syncLimit: 1499,
  },
  {
    plan: "ADVENTURE",
    name: "Adventure Plan",
    price: 49.99,
    syncLimit: 4999
  },
  {
    plan: "HEROIC",
    name: "Heroic Plan",
    price: 59.99,
    syncLimit: 0,
  },
];

export type OrderWithTransactionId = Shopify.IOrder & { transactionId: string };
