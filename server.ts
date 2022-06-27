import { PLAN, ORDER_STATUS, PLAN_STATUS } from "./types/enums";
import RestShopify, { IOrder } from "shopify-api-node";
import admin from "firebase-admin";
import dotenv from "dotenv";
import "isomorphic-fetch";
import createShopifyAuth, { verifyRequest } from "@shopify/koa-shopify-auth";
import Shopify, { ApiVersion, ShopifyHeader } from "@shopify/shopify-api";
import Koa from "koa";
import koaBody from "koa-body";
import next from "next";
import Router from "koa-router";
import db from "./utils/db";
import auth from "./utils/auth";

import { handleFulfilledOrder } from "./webhooks/handlers";
import { getSubscriptionUrl } from "./handlers";
import { BadParameter } from "./utils/errors";
import { getIdentity, getToken } from "./services/paypal";
import { Shop } from "types/db";
import { getAllOrders } from "./services/shopify";
import { handleHistoricalOrders } from "./workers/orders";
import * as Sentry from "@sentry/node";
import { isPayPalOrder } from "./utils/shopify";
import {
  deleteCallback,
  loadCallback,
  storeCallback,
} from "./utils/sessionStorage";

dotenv.config();
const port = process.env.PORT || 8081;
const dev = process.env.ENV === "DEV";
const app = next({
  dev,
});
const handle = app.getRequestHandler();

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY || "",
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET || "",
  SCOPES: process.env.SCOPES ? process.env.SCOPES.split(",") : [],
  HOST_NAME: process.env.HOST,
  API_VERSION: ApiVersion.October21,
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
    storeCallback,
    loadCallback,
    deleteCallback
  ),
});

Sentry.init({
  dsn:
    "https://327ae80f51c64a3295dd1fae208b2a37@o1194231.ingest.sentry.io/6316704",
});

async function storeAccessToken(shop: string, token: string) {
  return await db.collection("shops").doc(shop).set(
    {
      accessToken: token,
      installDate: admin.firestore.FieldValue.serverTimestamp(),
      uninstalled: false,
    },
    { merge: true }
  );
}

async function registerWebhooks(shop: string, accessToken: string) {
  const client = new RestShopify({
    shopName: shop,
    accessToken: accessToken,
  });

  const response = await client.webhook.create({
    topic: "app/uninstalled",
    address: process.env.WEBHOOKS_URL,
  });

  console.log(`Webhook response: ${JSON.stringify(response)}`);
  return true;
}

app.prepare().then(async () => {
  const server = new Koa();
  const router = new Router();

  server.on("error", (err, ctx) => {
    Sentry.withScope(function (scope) {
      scope.addEventProcessor(function (event) {
        return Sentry.Handlers.parseRequest(event, ctx.request);
      });
      Sentry.captureException(err);
    });
  });

  server.keys = [Shopify.Context.API_SECRET_KEY];
  server.use(
    createShopifyAuth({
      accessMode: "offline",
      async afterAuth(ctx) {
        console.log("Auth completed");
        const { shop, accessToken } = ctx.state.shopify;
        const host = ctx.query.host;
        const shopName = shop.split(".myshopify.com")[0];
        const shopDb = await db.collection("shops").doc(shopName).get();
        await storeAccessToken(shopName, accessToken);
        if (!shopDb.exists) {
          await registerWebhooks(shop, accessToken);
        } else {
          if (shopDb.data().uninstalled === true) {
            await registerWebhooks(shop, accessToken);
          }
        }

        const customToken = await auth.createCustomToken(shopName);
        ctx.redirect(
          `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/setup?host=${host}&authToken=${customToken}`
        );
      },
    })
  );

  const handleRequest = async (ctx: any) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  };

  router.get("/", async (ctx) => {
    const shop = ctx.query.shop;

    if (!shop) {
      ctx.status = 200;
      ctx.body = "Please specify your shop to install the app.";
    }

    const shopName = shop.toString().split(".myshopify.com")[0];
    const shopRef = db.collection("shops").doc(shopName);

    const shopDb = await shopRef.get();
    const shopData = shopDb.data();

    // If this shop hasn't been seen yet, go through OAuth to create a session
    if (shopDb.exists === false || shopData.uninstalled === true) {
      ctx.redirect(`/auth?shop=${shop}`);
    } else {
      // Load app skeleton. Don't include sensitive information here!
      await handleRequest(ctx);
    }
  });

  router.post("/webhooks", koaBody(), async (ctx) => {
    try {
      const topic = ctx.request.headers[ShopifyHeader.Topic.toLowerCase()];
      const shop = ctx.request.headers[
        ShopifyHeader.Domain.toLowerCase()
      ] as string;
      const body: IOrder = ctx.request.body;
      console.log(`Webhook: ${topic}`);
      switch (topic) {
        case "orders/fulfilled":
          await handleFulfilledOrder(topic, shop, body);
          ctx.status = 200;
          ctx.body = true;
          break;
        case "app/uninstalled":
          console.log("uninstalled webhook hit at handler through url ");
          const shopName = shop.split(".myshopify.com")[0];
          await db.collection("shops").doc(shopName).update({
            uninstalled: true,
            "currentPlan.status": PLAN_STATUS.CANCELLED,
          });
          break;
      }

      console.log(`Webhook processed, returned status code 200`);
      ctx.status = 200;
      ctx.body = true;
    } catch (error) {
      console.error(`Failed to process webhook: ${error}`);
      ctx.status = 503;
    }
  });

  router.post(
    "/graphql",
    verifyRequest({ returnHeader: true, accessMode: "offline" }),
    async (ctx, _next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );

  router.get("(/_next/static/.*)", handleRequest); // Static content is clear
  router.get("/_next/webpack-hmr", handleRequest); // Webpack content is clear

  router.get("/api/paypal/auth/callback", async (ctx) => {
    const { code, state } = ctx.query;
    const shopName = state as string;

    try {
      const paypalCreds = await getToken(code.toString());
      const identity = await getIdentity(paypalCreds.access_token);

      const dbShop = db.collection("shops").doc(shopName);
      const shopData = (await dbShop.get()).data();
      const accessToken = shopData.accessToken;
      await dbShop.update({
        paypalToken: paypalCreds.access_token,
        paypalRefreshToken: paypalCreds.refresh_token,
        paypalEmail: identity.emails.find((e) => e.primary === true).value,
      });

      const client = new RestShopify({
        shopName: `${shopName}.myshopify.com`,
        accessToken: accessToken,
      });

      const response = await client.webhook.create({
        topic: "orders/fulfilled",
        address: process.env.WEBHOOKS_URL,
      });

      console.log(`Webhook response: ${JSON.stringify(response)}`);

      if (shopData.backSync === true) {
        ctx.redirect(
          `https://${shopName}.myshopify.com/admin/apps/${
            process.env.SHOPIFY_API_KEY
          }/?shop=${shopName}.myshopify.com&host=${Buffer.from(
            shopName + ".myshopify.com/admin"
          ).toString("base64")}`
        );
        return;
      }

      ctx.redirect(
        `https://${shopName}.myshopify.com/admin/apps/${
          process.env.SHOPIFY_API_KEY
        }/setup-backsync?shop=${shopName}.myshopify.com&host=${Buffer.from(
          shopName + ".myshopify.com/admin"
        ).toString("base64")}`
      );
    } catch (error) {
      console.log(error);
      ctx.body = { success: false, error };
    }
  });

  router.get(
    "/api/shopify/getSubscriptionUrl",
    verifyRequest({ returnHeader: true, accessMode: "offline" }),
    async (ctx) => {
      const plan: PLAN = (ctx.query.plan as unknown) as PLAN;
      let trialDays = 7;
      const session = await Shopify.Utils.loadCurrentSession(
        ctx.req,
        ctx.res,
        false
      );

      const shopDb = (
        await db
          .collection("shops")
          .doc(session.shop.split(".myshopify.com")[0])
          .get()
      ).data() as Shop;

      if (shopDb.currentPlan && shopDb.currentPlan.isTrial) {
        const today = new Date();
        const trialAdded = shopDb.currentPlan.trialAdded.toDate();
        const diffTime = today.getTime() - trialAdded.getTime();
        var diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
        trialDays = Math.max(7 - diffDays, 0);
      }

      const graphQLClient = new Shopify.Clients.Graphql(
        session.shop,
        session.accessToken
      );

      ctx.body = await getSubscriptionUrl(graphQLClient, plan, trialDays);
    }
  );

  router.get(
    "/api/auth/token",
    verifyRequest({ returnHeader: true, accessMode: "offline" }),
    async (ctx) => {
      const session = await Shopify.Utils.loadCurrentSession(
        ctx.req,
        ctx.res,
        false
      );
      const shopName = session.shop.split(".myshopify.com")[0];
      if (session) {
        const customToken = await auth.createCustomToken(shopName);
        ctx.body = { token: customToken };
      } else {
        ctx.throw(403);
      }
    }
  );

  router.get("/api/shopify/charge_callback", async (ctx) => {
    const chargeId = ctx.query.charge_id;
    const plan = ctx.query.plan.toString();

    const newPlan: any = {
      chargeId,
      plan,
      isTrial: false,
      status: PLAN_STATUS.ACTIVE,
    };
    const shopName = ctx.query.shopName.toString();
    if (!shopName) throw new BadParameter("Missing 'shopName' param");

    const dbShop = db.collection("shops").doc(shopName);
    const shopDoc = await dbShop.get();
    if (!shopDoc.data().currentPlan) {
      newPlan.isTrial = true;
      newPlan.trialAdded = admin.firestore.FieldValue.serverTimestamp();
    } else {
      if (shopDoc.data().currentPlan.isTrial == true) {
        const today = new Date();
        const trialAdded = shopDoc.data().currentPlan.trialAdded.toDate();
        const diffTime = today.getTime() - trialAdded.getTime();
        var diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
        const trialDays = Math.max(7 - diffDays, 0);
        console.log(`trialDays for callback: ${trialDays}`);
        newPlan.isTrial = trialDays > 0;
        newPlan.trialAdded = shopDoc.data().currentPlan.trialAdded;
      }
    }
    await dbShop.update({ currentPlan: newPlan });

    if (shopDoc.data().backSync === true) {
      ctx.redirect(
        `https://${shopName}.myshopify.com/admin/apps/${
          process.env.SHOPIFY_API_KEY
        }/?shop=${shopName}.myshopify.com&host=${Buffer.from(
          shopName + ".myshopify.com/admin"
        ).toString("base64")}`
      );
      return;
    }

    ctx.redirect(
      `https://${shopName}.myshopify.com/admin/apps/${
        process.env.SHOPIFY_API_KEY
      }/setup-backsync?shop=${shopName}.myshopify.com&host=${Buffer.from(
        shopName + ".myshopify.com/admin"
      ).toString("base64")}`
    );
  });
  router.get("/api/shopify/customers/data_request", async (ctx) => {
    ctx.status = 200;
    ctx.body = true;
  });
  router.get("/api/shopify/customers/redact", async (ctx) => {
    ctx.status = 200;
    ctx.body = true;
  });
  router.get("/api/shopify/shop/redact", async (ctx) => {
    ctx.status = 200;
    ctx.body = true;
  });

  router.get(
    "/api/shopify/historical",
    verifyRequest({ returnHeader: true, accessMode: "offline" }),
    async (ctx) => {
      const session = await Shopify.Utils.loadCurrentSession(
        ctx.req,
        ctx.res,
        false
      );

      const client = new RestShopify({
        shopName: session.shop,
        accessToken: session.accessToken,
        autoLimit: true,
      });
      const shopName = session.shop.split(".myshopify.com")[0];
      const shopRef = db.collection("shops").doc(shopName);

      const shop = await shopRef.get();
      const shopData = shop.data();
      if (shopData.backSync === true) {
        ctx.body = "You already synchronized your orders";
        return;
      }
      const ordersRef = shopRef.collection("orders");
      let allOrders = await getAllOrders(client);
      const paypalOrders = allOrders.filter(
        (o) => o.fulfillments.length > 0 && isPayPalOrder(o)
      );

      await shopRef.update({
        backSync: true,
      });

      // Answer to request to not block the client.
      ctx.body = true;

      Promise.all(
        paypalOrders.map(async (o) => {
          return await ordersRef.add({
            shopifyId: o.id,
            historical: true,
            name: o.name,
            transactionId: "",
            trackingNumbers: o.fulfillments.map((f) => {
              return {
                trackingNumber: f.tracking_number,
                trackingCompany: f.tracking_company,
              };
            }),
            status: ORDER_STATUS.PENDING,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        })
      ).then((dbOrders) =>
        console.log(
          `Written ${
            dbOrders.filter((o) => o.id).length
          } historical orders in DB.`
        )
      );

      handleHistoricalOrders(paypalOrders, shopName);
    }
  );

  // Any route starting with `/api` will not be checked for Shopify auth
  router.all("/api/(.*)", async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  });

  router.get("(.*)", async (ctx) => {
    const shop = ctx.query.shop as string;
    if (shop) {
      const shopName = shop.split(".myshopify.com")[0];
      const dbShop = await db.collection("shops").doc(shopName).get();
      if (dbShop.exists === false) {
        console.log("Shop doesn't exist, redirect to auth.");
        ctx.redirect(`/auth?shop=${shop}`);
      } else {
        await handleRequest(ctx);
      }
    } else {
      await handleRequest(ctx);
    }
  });

  server.use(router.allowedMethods());
  server.use(router.routes());
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
