import Shopify, { IOrder, IPaginatedResult } from "shopify-api-node";
export async function getAllOrders(client: Shopify) {
  let ordersRes: IPaginatedResult<IOrder> = null;
  let allOrders: IOrder[] = [];
  let params: any = { limit: 250 };
  do {
    ordersRes = await client.order.list(params);
    const orders = ordersRes;
    if (orders.length > 0) {
      allOrders = [...allOrders, ...orders];
    }

    params = ordersRes.nextPageParameters;

  } while (params !== undefined);
  return allOrders;
}
