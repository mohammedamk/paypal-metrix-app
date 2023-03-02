
import { Loading, useAppBridge } from "@shopify/app-bridge-react";
import { Button, ButtonGroup, Card, Modal, Page, Stack } from "@shopify/polaris";
import { useRouter } from "next/dist/client/router";
import { Redirect } from '@shopify/app-bridge/actions';
import firebase from "../utils/firebase"
import React, { useEffect, useState } from "react";
import { useAuth } from "providers/authProvider";
import { getSessionToken } from "@shopify/app-bridge-utils";
import withPlan from "hocs/withPlanAndLogin";



const Setup = () => {
  const app = useAppBridge()
  const redirect = Redirect.create(app)
  const router = useRouter()
  const shopUrl = router.query.shop as string
  const shopName = shopUrl.split(".myshopify.com")[0]

  const [shop, setShop] = useState<any>()


  const { authUser, signInWithToken } = useAuth();

  useEffect(() => {
    const { authToken } = router.query
    console.log(authToken)
    if (!authToken) {
      console.log('No Auth Token')
      redirect.dispatch(Redirect.Action.APP, `/auth?shop=${shopUrl}`)
      return
    }

    signInWithToken(authToken.toString()).then(user => console.log("Signed in to Firebase")).catch(error => console.error(error))

  }, [])


  useEffect(() => {
    if (!authUser) {
      return;
    }
    const shopReq = firebase.firestore.collection("shops").doc(authUser.uid).get()
    shopReq.then(shop => {
      if (shop.data().paypalToken) {
        console.log("Already setup, redirect to dashboard.")
        redirect.dispatch(Redirect.Action.APP, `/`)
      } else {
        setShop(shop.data())
      }

    })
  }, [authUser])

  async function authPaypal() {
    redirect.dispatch(Redirect.Action.REMOTE, `${process.env.PAYPAL_LOGIN_URL}/connect/?flowEntry=static&client_id=${process.env.PAYPAL_CLIENT_ID}&response_type=code&scope=openid profile email https://uri.paypal.com/services/paypalattributes https://uri.paypal.com/services/shipping/trackers/readwrite&redirect_uri=https://${process.env.HOST}/api/paypal/auth/callback?state=${shopName}`)
  }


  if (!authUser || !shop) {
    return <Loading></Loading>
  }


  return (
    <Page>
      <Card title="Let's get started"

        primaryFooterAction={{ content: 'Connect with PayPal', onAction: async () => { await authPaypal() } }}
      >
        <Card.Section>
          <Stack spacing="loose" vertical>
            <p>
               will get access to your PayPal account and start synchronizing your tracking numbers automatically. <br />
              Only the required permissions will be obtained.
            </p>
            <p>
              Once you're ready, click on "Connect with PayPal", login (if needed) and approve the connection.
            </p>

          </Stack>
        </Card.Section>


      </Card>

    </Page >
  )
};

export default Setup;




