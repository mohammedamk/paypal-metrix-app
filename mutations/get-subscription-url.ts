import { PLAN } from "../types/enums";
import "isomorphic-fetch";
import { gql } from "apollo-boost";
import { GraphqlClient } from "@shopify/shopify-api/dist/clients/graphql";

export function RECURRING_CREATE(url: string, plan: PLAN, trialDays: number) {
  let planName = "";
  let planPrice = 0;
  switch (plan) {
    case "FREE":
      planName = "Free";
      planPrice = 0.01;
      break;
    case "MICRO":
      planName = "Micro";
      planPrice = 9.99;
      break;
    case "DISCOVERY":
      planName = "Discovery";
      planPrice = 29.99;
      break;
    case "ADVENTURE":
      planName = "Adventure";
      planPrice = 49.99;
      break;
    case "HEROIC":
      planName = "Heroic";
      planPrice = 59.99;
      break;
  }
  return `
    mutation {
      appSubscriptionCreate(
          name: "${planName} Plan"
          returnUrl: "${url}"
          test: ${process.env.ENV === "DEV"}
          trialDays:${trialDays}
          lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                  price: { amount: ${planPrice}, currencyCode: USD }
              }
            }
          }
          ]
        ) {
            userErrors {
              field
              message
            }
            confirmationUrl
            appSubscription {
              id
            }
        }
    }`;
}

export const getSubscriptionUrl = async (
  graphQLClient: GraphqlClient,
  plan: PLAN,
  trialDays: number
) => {
  const query = `plan=${plan}&shopName=${
    graphQLClient.domain.split(".myshopify.com")[0]
  }`;
  const res = await graphQLClient.query({
    data: RECURRING_CREATE(
      `https://${process.env.HOST}/api/shopify/charge_callback?${query}`,
      plan,
      trialDays
    ),
  });

  const confirmationUrl = res.body;

  return confirmationUrl;
};
