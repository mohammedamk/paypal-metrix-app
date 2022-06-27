import { IOrder } from "shopify-api-node";

export function isPayPalOrder(order: IOrder) {
  return (
    order.payment_gateway_names.findIndex(
      (gateway) => gateway.toLowerCase() === "paypal"
    ) > -1
  );
}
