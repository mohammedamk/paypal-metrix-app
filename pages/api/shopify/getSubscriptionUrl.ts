import { PLAN } from "./../../../types/enums";
import { getSubscriptionUrl } from "../../../handlers";

export default async (req, res) => {
  const plan: PLAN = req.query.plan;
};
