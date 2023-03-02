
import { Loading, Toast, useAppBridge } from "@shopify/app-bridge-react";
import { AccountConnection, Button, Caption, Card, Frame, Heading, Layout, Navigation, Page, ProgressBar, Stack, Subheading, TextContainer, TextStyle, Tooltip } from "@shopify/polaris";
import firebase from "../utils/firebase"
import fb from "firebase/app";
import React, { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/dist/client/router";
import { useAuth } from "providers/authProvider";
import { Redirect } from "@shopify/app-bridge/actions";
import { getPlanLimits, getPlanName } from "utils/plans";
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import withPlan from "hocs/withPlanAndLogin";
import moment from "moment";
import pluralize from 'pluralize'
import { useNavigation } from "../providers/navProvider";
import { AppLink } from '@shopify/app-bridge/actions';

const Settings = () => {
  const { authUser } = useAuth()
  const navMenu = useNavigation()
  const router = useRouter()
  const app = useAppBridge()

  const [shop, setShop] = useState<any>(null)
  const [active, setActive] = useState(false);
  const [toastContent, setToastContent] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [planLimits, setPlanLimits] = useState(null)
  const [monthlyUsage, setMonthlyUsage] = useState(null)

  const redirect = Redirect.create(app)
  const fetchFunc = authenticatedFetch(app)

  const toggleActive = useCallback(() => setActive((active) => !active), []);
  async function backsync() {
    setIsSyncing(true)
    try {
      const res = await fetchFunc("/api/shopify/historical")
      setToastContent("Great! Your orders are pending synchronization.")
      toggleActive()
      await fetchShop()
    } catch (error) {
      console.error(error)
    }
    finally { setIsSyncing(false) }


  }
  const toastMarkup = active ? (
    <Toast content={toastContent} onDismiss={toggleActive} />
  ) : null;

  async function fetchShop() {
    const shopDoc = firebase.firestore.collection("shops").doc(authUser.uid);
    const shop = await shopDoc.get()
    setShop(shop.data())
    if (shop.data().currentPlan) {
      const planLimits = getPlanLimits(shop.data().currentPlan.plan)
      setPlanLimits(planLimits)
    }
    const orders = await shopDoc.collection('orders').where('synchronizedAt', ">=", moment().startOf('month').toDate()).where('historical', '==', false).get()
    setMonthlyUsage(orders.docs.length)
  }

  useEffect(() => {
    if (!authUser) { return; }
    fetchShop()
  }, [authUser])

  useEffect(() => {
    if (!navMenu) {
      return
    }
    const link = navMenu.children.find((c: AppLink.AppLink) => c.destination === router.pathname) as AppLink.AppLink
    navMenu.set({ active: link })
  }, [])


  if (!shop) {
    return <div style={{ height: '100px' }}>
      <Frame>
        <Loading />
      </Frame>
    </div>
  }

  async function connect() {
    redirect.dispatch(Redirect.Action.REMOTE, `${process.env.PAYPAL_LOGIN_URL}/connect/?flowEntry=static&client_id=${process.env.PAYPAL_CLIENT_ID}&response_type=code&scope=openid profile email https://uri.paypal.com/services/paypalattributes https://uri.paypal.com/services/disputes/read-seller https://uri.paypal.com/services/disputes/update-seller https://uri.paypal.com/services/shipping/trackers/readwrite&redirect_uri=https://${process.env.HOST}/api/paypal/auth/callback?state=${authUser.uid}`)
  }

  async function disconnect() {
    const shop = firebase.firestore.collection("shops").doc(authUser.uid)
    await shop.update({
      paypalToken: fb.firestore.FieldValue.delete(),
      paypalRefreshToken: fb.firestore.FieldValue.delete()
    })
    await fetchShop()
    setToastContent("PayPal account successfully disconnected.")
    toggleActive()
    // TODO Disable auto-sync + cancel fulfilled webhook
  }



  return (
    <Page title="Settings">
      <Layout>
        <Layout.AnnotatedSection
          title="Your current plan"
        >
          <Card title={`${shop.currentPlan && getPlanName(shop.currentPlan.plan)}`} sectioned>

            <Stack vertical>
              <p>Monthly usage</p>
              {planLimits !== 0 && <Tooltip preferredPosition="above" content={`${monthlyUsage} ${pluralize('synchronization', monthlyUsage)} / ${planLimits}`}> <ProgressBar progress={planLimits !== null ? (monthlyUsage / planLimits) * 100 : 0} /></Tooltip>}
              {planLimits === 0 && <TextContainer>{monthlyUsage} / Unlimited synchronizations</TextContainer>}
              <Button onClick={() => redirect.dispatch(Redirect.Action.APP, "/plans")} plain>Change plan</Button>
            </Stack>

          </Card>
        </Layout.AnnotatedSection>
        <Layout.AnnotatedSection
          title="PayPal merchant connection"
          description="Connect your PayPal account to enable automatic synchronization."
        >
          <AccountConnection
            accountName={`PayPal`}
            connected={shop && shop.paypalToken}
            action={{
              content: shop && shop.paypalToken ? "Disconnect" : "Connect",

              onAction: async () => { shop && shop.paypalToken ? await disconnect() : await connect() },
            }}
            title={shop.paypalToken ? `PayPal (${shop.paypalEmail})` : `PayPal`}
            details={shop && shop.paypalToken ? "Account connected" : "No account connected"}

          />
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Back to the future"
        >
          <Card title="Synchronize historical orders" sectioned
            secondaryFooterActions={[{ content: 'Synchronize historical orders', onAction: backsync, loading: isSyncing, disabled: shop.backSync == true }]}
          >
            <p>Do you want to upload your historical tracking numbers (up to 60 days ago) to Paypal? This operation is completely <i>free of charge</i>.</p>
            {shop.backSync === true && <TextStyle variation="negative">You already synchronized your orders.</TextStyle>}

          </Card>
        </Layout.AnnotatedSection>

      </Layout>
      {toastMarkup}



    </Page>
  )
};

export default withPlan(Settings);


