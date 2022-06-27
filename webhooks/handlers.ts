import { getPlanLimits } from "../utils/plans";
import moment from "moment";
import { InvalidPaypalToken } from "../utils/errors";
import firebase from "firebase-admin";
import { ORDER_STATUS } from "./../types/enums";
import { PaypalCreds, PaypalTracking } from "./../types/paypal";
import db from "../utils/db";
import { refreshToken, synchronizeSingle } from "../services/paypal";
import Shopify, { IOrder } from "shopify-api-node";
import { add } from "lodash";
import { isPayPalOrder } from "../utils/shopify";

async function addOrder(
  shopName: string,
  order: IOrder,
  transactionId: string,
  status: ORDER_STATUS
) {
  const dbShop = db.collection("shops").doc(shopName);
  const shopOrders = dbShop.collection("orders");

  const addRes = await shopOrders.add({
    shopifyId: order.id,
    name: order.name,
    transactionId,
    historical: false,
    trackingNumbers: order.fulfillments.map((f) => {
      return {
        trackingNumber: f.tracking_number,
        trackingCompany: f.tracking_company,
      };
    }),
    status,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return addRes;
}

export async function handleFulfilledOrder(
  _topic: string,
  shop: string,
  order: IOrder
): Promise<void> {
  console.log(`Handling ${shop} fulfilled order.`);
  const shopName = shop.split(".myshopify.com")[0];

  const shopDb = db.collection("shops").doc(shopName);
  const shopDbDoc = await shopDb.get();

  if (!shopDbDoc.exists) {
    console.log("Shop doesn't exist in DB. Cannot handle fullfilled order.");
    return;
  }

  if (isPayPalOrder(order) === false) {
    console.debug(`Order ${order.id} from shop: ${shop} isn't PayPal order.`);
    return;
  }

  const client = new Shopify({
    shopName: shop,
    accessToken: shopDbDoc.data().accessToken,
  });

  const transactionIdRes = await client.transaction.list(order.id);

  if (!transactionIdRes || transactionIdRes.length < 1) {
    console.log("No transaction found for this order.");
    return;
  }

  const successfulTransaction = transactionIdRes.find(
    (transaction) => transaction.status === "success"
  );
  if (!successfulTransaction) {
    console.log("No successful transaction in this order.");
    return;
  }

  const transactionId = successfulTransaction.authorization;

  const monthlyOrders = await shopDb
    .collection("orders")
    .where("synchronizedAt", ">=", moment().startOf("month").toDate())
    .where("historical", "==", false)
    .get();

  const planLimits = getPlanLimits(shopDbDoc.data().currentPlan.plan);

  if (monthlyOrders.docs.length >= planLimits && planLimits !== 0) {
    await addOrder(
      shopName,
      order,
      transactionId,
      ORDER_STATUS.INSUFFICIENT_CREDITS
    );
    return;
  }

  const paypalCredentials: PaypalCreds = {
    token: shopDbDoc.data().paypalToken,
    refreshToken: shopDbDoc.data().paypalRefreshToken,
  };
  const dbAddRes = await addOrder(
    shopName,
    order,
    transactionId,
    ORDER_STATUS.PROCESSING
  );

  const trackings: PaypalTracking[] = order.fulfillments.map((f) => {
    return {
      tracking_number: f.tracking_number,
      tracking_company: f.tracking_company,
    };
  });
  let syncRes = null;
  try {
    syncRes = await synchronizeSingle(
      trackings,
      transactionId,
      paypalCredentials.token
    );
  } catch (error) {
    console.error(error);
    if (error instanceof InvalidPaypalToken) {
      console.log("invalid paypal token, lets refresh it ");
      const newToken = await refreshToken(paypalCredentials.refreshToken);
      await shopDb.update({ paypalToken: newToken.access_token });
      syncRes = await synchronizeSingle(
        trackings,
        transactionId,
        newToken.access_token
      );
    } else {
      return;
    }
  } finally {
    if (syncRes === true) {
      dbAddRes.update({
        status: ORDER_STATUS.PROCESSED,
        synchronizedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      dbAddRes.update({ status: ORDER_STATUS.FAILED });
    }
  }
}
