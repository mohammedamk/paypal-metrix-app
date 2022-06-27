import {
  PayPalError,
  PaypalRefreshTokenRes,
  PaypalTracker,
  PaypalTrackerReq,
  PaypalTrackerRes,
} from "./../types/paypal";
import axios, { AxiosError } from "axios";
import db from "utils/db";
import {
  PaypalCreds,
  PaypalIdentityRes,
  PaypalInitialTokenRes,
  PaypalTracking,
} from "types/paypal";
import { InvalidPaypalToken } from "../utils/errors";

export async function getToken(code: string): Promise<PaypalInitialTokenRes> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const endpoint =
    process.env.ENV == "DEV"
      ? process.env.PAYPAL_SANDBOX_API_ENDPOINT
      : process.env.PAYPAL_API_ENDPOINT;
  const paypalRes = await axios.post<PaypalInitialTokenRes>(
    `${endpoint}/oauth2/token`,
    `grant_type=authorization_code&code=${code}`,
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded", // => needed to handle data parameter
        "Accept-Language": "en_US",
      },
      auth: {
        username: clientId,
        password: secret,
      },
    }
  );
  return paypalRes.data;
}

export async function getIdentity(token: string): Promise<PaypalIdentityRes> {
  const endpoint =
    process.env.ENV == "DEV"
      ? process.env.PAYPAL_SANDBOX_API_ENDPOINT
      : process.env.PAYPAL_API_ENDPOINT;
  const identityRes = await axios.get<PaypalIdentityRes>(
    `${endpoint}/identity/oauth2/userinfo?schema=paypalv1.1`,
    {
      headers: {
        "Content-Type": "Content-Type: application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return identityRes.data;
}

export async function refreshToken(
  refreshToken: string
): Promise<PaypalRefreshTokenRes> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const endpoint =
    process.env.ENV == "DEV"
      ? process.env.PAYPAL_SANDBOX_API_ENDPOINT
      : process.env.PAYPAL_API_ENDPOINT;
  const paypalRes = await axios.get<PaypalRefreshTokenRes>(
    `${endpoint}/identity/openidconnect/tokenservice?grant_type=refresh_token&refresh_token=${refreshToken}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
      },
      auth: {
        username: clientId,
        password: secret,
      },
    }
  );

  if (paypalRes.data.errors && paypalRes.data.errors.length > 0) {
    console.error(JSON.stringify(paypalRes.data.errors));
  }

  return paypalRes.data;
}

export async function synchronizeSingle(
  trackingNumbers: PaypalTracking[],
  transactionId: string,
  token: string
): Promise<boolean> {
  console.log(trackingNumbers);
  const data = {
    trackers: trackingNumbers.map((t) => {
      let tracker = {
        transaction_id: transactionId,
        tracking_number: t.tracking_number,
        status: "SHIPPED",
      };
      const trackingCompany = getCarrierFromOrder(t.tracking_company);
      if (trackingCompany !== "") {
        return { ...tracker, carrier: trackingCompany };
      } else {
        return {
          ...tracker,
          carrier: "OTHER",
          carrier_name_other: t.tracking_company,
        };
      }
    }),
  };

  try {
    const syncRes = await synchronizeToPaypal(token, data);
    return syncRes;
  } catch (error) {
    if (error instanceof InvalidPaypalToken) {
      console.error("Invalid paypalt oken error, lets throw it up");
      throw error;
    } else {
      console.error(error);
      return false;
    }
  }
}

export async function synchronizeMultiple(
  trackingInfos: ({
    trackingInfo: PaypalTracking;
    transactionId: string;
  } | null)[],
  token: string
): Promise<boolean> {
  const data: PaypalTrackerReq = {
    trackers: trackingInfos
      .filter((trackingInfo) => trackingInfo !== null)
      .map((t) => {
        let tracker: PaypalTracker = {
          transaction_id: t.transactionId,
          tracking_number: t.trackingInfo.tracking_number,
          status: "SHIPPED",
          carrier: "",
        };
        const trackingCompany = getCarrierFromOrder(
          t.trackingInfo.tracking_company
        );
        if (trackingCompany !== "") {
          return { ...tracker, carrier: trackingCompany };
        } else {
          return {
            ...tracker,
            carrier: "OTHER",
            carrier_name_other: t.trackingInfo.tracking_company,
          };
        }
      }),
  };

  try {
    const syncRes = await synchronizeToPaypal(token, data);
    return syncRes;
  } catch (error) {
    if (error instanceof InvalidPaypalToken) {
      console.error("Invalid PayPal token error, lets throw it up");
      throw error;
    } else {
      console.error(error);
      return false;
    }
  }
}

function getCarrierFromOrder(trackingCompany: any): string {
  const carrierMap = new Map<string, string>([
    ["4PX", "FOUR_PX_EXPRESS"],
    ["APC", "APC_OVERNIGHT"],
    ["Australia Post", "AUSTRALIA_POST"],
    ["Bluedart", "BLUEDART"],
    ["Canada Post", "CANADA_POST"],
    ["China Post", "CHINA_POST"],
    ["Correios", "BRA_CORREIOS"],
    ["DHL Express", "DHL"],
    ["DHL eCommerce", "DHL_GLOBAL_MAIL"],
    ["DHL eCommerce Asia", "DHL_GLOBAL_MAIL_ASIA"],
    ["DPD", "DPD"],
    ["DPD Local", "DPD_LOCAL"],
    ["DPD UK", "DPD_UK"],
    ["Delhivery", "DELHIVERY_IN"],
    ["FedEx", "FEDEX"],
    ["GLS", "GLS"],
    ["Globegistics", "GLOBEGISTICS"],
    ["Japan Post (EN)", "JAPAN_POST"],
    ["Japan Post (JA)", "JAPAN_POST"],
    ["La Poste", "LAPOSTE"],
    ["New Zealand Post", "NZ_POST"],
    ["Newgistics", "APC"],
    ["PostNL", "POSTNL"],
    ["PostNord", "POSTNORD_LOGISTICS_GLOBAL"],
    ["Purolator", "PUROLATOR"],
    ["Royal Mail", "ROYAL_MAIL"],
    ["SF Express", "SF_EXPRESS"],
    ["Sagawa (EN)", "SAGAWA"],
    ["Sagawa (JA)", "SAGAWA_JP"],
    ["Singapore Post", "SINGPOST"],
    ["TNT", "TNT"],
    ["UPS", "UPS"],
    ["USPS", "USPS"],
    ["Yamato (EN)", "YAMATO"],
    ["Yamato (JA)", "JPN_YAMATO"],
  ]);
  return carrierMap.get(trackingCompany) || "";
}

async function synchronizeToPaypal(token: string, data: PaypalTrackerReq) {
  try {
    const endpoint =
      process.env.ENV == "DEV"
        ? process.env.PAYPAL_SANDBOX_API_ENDPOINT
        : process.env.PAYPAL_API_ENDPOINT;
    const syncRes = await axios.post<PaypalTrackerRes>(
      `${endpoint}/shipping/trackers-batch`,
      data,
      {
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(syncRes.data);

    if (syncRes.data.errors && syncRes.data.errors.length > 0) {
      const errors: PayPalError[] = syncRes.data.errors;
      console.error(JSON.stringify(errors));
      return true;
    }

    return true;
  } catch (error) {
    const axiosError: AxiosError = error;
    if (axiosError) {
      const errorResponse = axiosError.response.data;
      console.log(errorResponse);
      if (errorResponse.error && errorResponse.error == "invalid_token") {
        throw new InvalidPaypalToken();
      }
    }
    return true;
  }
}
