import Shopify, { IOrder } from "shopify-api-node";
import { Job } from "bullmq";
import db from "../utils/db";
import { PaypalCreds, PaypalTracking } from "../types/paypal";
import {
  refreshToken,
  synchronizeMultiple,
  synchronizeSingle,
} from "../services/paypal";
import { InvalidPaypalToken } from "../utils/errors";
import { ORDER_STATUS } from "../types/enums";
import firebase from "firebase-admin";
import stopcock from "stopcock";
import _ from "lodash";
import { OrderWithTransactionId } from "../types/shopify";

export async function handleHistoricalOrders(
  orders: IOrder[],
  shopName: string
) {
  const shopDb = db.collection("shops").doc(shopName);
  const shopDbDoc = await shopDb.get();
  console.log(`Handling historical orders. ${orders.length} Orders Found`);

  if (!shopDbDoc.exists) {
    console.log("Shop doesn't exist in DB. Cannot handle historical order.");
    return;
  }

  const client = new Shopify({
    shopName: shopName,
    accessToken: shopDbDoc.data().accessToken,
    autoLimit: true,
  });

  let paypalCredentials: PaypalCreds = {
    token: shopDbDoc.data().paypalToken,
    refreshToken: shopDbDoc.data().paypalRefreshToken,
  };

  const transactionsIds: {
    orderId: string;
    transactionId: string;
  }[] = await getTransactionsIds(client, orders);

  const ordersWithTransactionId: OrderWithTransactionId[] = orders.map(
    (order) => {
      const matchingTransaction = transactionsIds.find(
        (transaction) => transaction.orderId === order.id.toString()
      );
      return {
        ...order,
        transactionId: matchingTransaction
          ? matchingTransaction.transactionId
          : "",
      };
    }
  );

  // PayPal support up to 20 trackings per order
  const ordersChunks = _.chunk(ordersWithTransactionId, 20);

  for (let orderChunk of ordersChunks) {
    let chunkResults = false;
    try {
      chunkResults = await syncChunkToPayPal(orderChunk, paypalCredentials);
    } catch (error) {
      if (error instanceof InvalidPaypalToken) {
        console.debug("Invalid paypal token, lets refresh it ");
        const newToken = await refreshToken(paypalCredentials.refreshToken);
        paypalCredentials.token = newToken.access_token;
        await shopDb.update({ paypalToken: newToken.access_token });
        chunkResults = await syncChunkToPayPal(orderChunk, paypalCredentials);
      } else {
        console.error(
          "Error while synching chunk of orders to PayPal. Not Token related."
        );
        console.error(error);
        continue;
      }
    } finally {
      if (chunkResults === true) {
        console.log(
          "Chunk results are true, let's update db orders to PROCESSED."
        );
        await updateChunkStatus(orderChunk, shopName);
      } else {
        console.log("Chunk results are false..");
      }
    }
  }

  return true;
}

async function getTransactionsIds(
  client: Shopify,
  orders: IOrder[]
): Promise<{ orderId: string; transactionId: string }[]> {
  return await Promise.all(
    orders.map(async (order) => {
      const transactionIdRes = await client.transaction.list(order.id);
      if (!transactionIdRes || transactionIdRes.length < 1) {
        console.log(`No transaction found for this order: ${order.id}`);
        return { orderId: order.id.toString(), transactionId: "" };
      }
      const successfulTransaction = transactionIdRes.find(
        (transaction) => transaction.status === "success"
      );
      if (!successfulTransaction) {
        console.log(`No successful transaction in order. ${order.id}`);
        return { orderId: order.id.toString(), transactionId: "" };
      }
      const transactionId = successfulTransaction.authorization;

      return { orderId: order.id.toString(), transactionId };
    })
  );
}

async function syncChunkToPayPal(
  orders: OrderWithTransactionId[],
  credentials: PaypalCreds
) {
  const trackingInfos = orders
    .filter((order) => order.transactionId !== "")
    .map((order) => {
      const fulfillment = order.fulfillments.find(
        (fulfillment) => fulfillment.status === "success"
      );
      if (!fulfillment) {
        return null;
      }
      const trackingInfo: PaypalTracking = {
        tracking_number: fulfillment.tracking_number,
        tracking_company: fulfillment.tracking_company,
      };
      return { trackingInfo, transactionId: order.transactionId };
    });

  const rateLimitedPaypal = stopcock(synchronizeMultiple, {
    bucketSize: 35,
    interval: 5000,
    limit: 1,
  });

  const chunkResults = await rateLimitedPaypal(
    trackingInfos,
    credentials.token
  );

  return chunkResults;
}
async function updateChunkStatus(
  orders: OrderWithTransactionId[],
  shopName: string
) {
  const batch = db.batch();

  const ordersRef = db.collection("shops").doc(shopName).collection("orders");
  for (const order of orders) {
    const orderDb = await ordersRef
      .where("shopifyId", "==", order.id)
      .where("status", "==", ORDER_STATUS.PENDING)
      .get();
    if (orderDb.empty) {
      console.log(`No order found in db with this shopify ID: ${order.id} `);
      continue;
    }
    const orderRef = ordersRef.doc(orderDb.docs[0].id);
    batch.update(orderRef, {
      status: ORDER_STATUS.PROCESSED,
      synchronizedAt: firebase.firestore.FieldValue.serverTimestamp(),
      transactionId: order.transactionId,
    });
  }

  await batch.commit();
}
