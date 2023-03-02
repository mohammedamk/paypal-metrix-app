import { useAuth } from "providers/authProvider";
import firebase from "../utils/firebase"
import React, { useEffect, useState } from "react";
import { Loading, useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from '@shopify/app-bridge/actions';
import { useRouter } from "next/dist/client/router";
import { PLAN_STATUS } from "types/enums";
const withPlanAndLogin = (Component) => (props) => {
  const { authUser } = useAuth()
  const app = useAppBridge()
  const router = useRouter()
  const redirect = Redirect.create(app)
  const shopUrl = router.query.shop as string
  const [shop, setShop] = useState<any>()

  useEffect(() => {
    if (authUser) {
      firebase.firestore.collection("shops").doc(authUser.uid).get().then(shop => {
        if (!shop.data().currentPlan || shop.data().currentPlan.status === PLAN_STATUS.CANCELLED) {
          redirect.dispatch(Redirect.Action.APP, '/plans')
        }
        else {
          setShop(shop)
        }
      })
    }

  }, [authUser]);

  if (!shop) {
    return <Loading />
  }

  return <Component {...props} />;
};
export default withPlanAndLogin;
