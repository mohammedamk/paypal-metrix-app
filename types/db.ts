import firebase from "firebase-admin";
import { ORDER_STATUS, PLAN, PLAN_STATUS } from "./enums";
export type Shop = {
  accessToken: string;
  currentPlan: {
    chargeId: string;
    plan: PLAN;
    isTrial: boolean;
    trialAdded?: firebase.firestore.Timestamp;
    status: PLAN_STATUS;
  };
  installDate: firebase.firestore.Timestamp;
  paypalEmail: string;
  paypalRefreshToken: string;
  paypalToken: string;
};
export type AppOrder = {
  createdAt: firebase.firestore.Timestamp;
  name: string;
  shopifyId: number;
  status: ORDER_STATUS;
  synchronizedAt: firebase.firestore.Timestamp;
  trackingNumbers: Array<{
    trackingCompany: string;
    trackingNumber: string;
    transactionId: string;
  }>;
};
