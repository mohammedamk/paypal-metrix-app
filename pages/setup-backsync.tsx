
import { Toast, useAppBridge } from "@shopify/app-bridge-react";
import { Banner, Button, ButtonGroup, Card, Layout, Page, Stack } from "@shopify/polaris";
import { useRouter } from "next/dist/client/router";
import { Redirect } from '@shopify/app-bridge/actions';
import firebase from "../utils/firebase"
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "providers/authProvider";
import useApi from "hooks/useApi";
import withPlan from "hocs/withPlanAndLogin";



const SetupBacksync = () => {
  const app = useAppBridge()
  const { authUser } = useAuth()
  const redirect = Redirect.create(app)
  const api = useApi()

  const [active, setActive] = useState(false);
  const [toastContent, setToastContent] = useState('')
  const [isBackSyncing, setIsBackSyncing] = useState(false)

  const toggleActive = useCallback(() => setActive((active) => !active), []);
  async function backsync() {
    setIsBackSyncing(true)
    await api.get("/api/shopify/historical")
    setToastContent("Great! Your orders are pending synchronization.")
    toggleActive()
    setIsBackSyncing(false)
    redirect.dispatch(Redirect.Action.APP, '/')
  }

  const toastMarkup = active ? (
    <Toast content={toastContent} onDismiss={toggleActive} />
  ) : null;


  useEffect(() => {
    if (!authUser) {
      return;
    }
    firebase.firestore.collection("shops").doc(authUser.uid).get().then(shop => {
      if (shop.data().backSync) {
        return redirect.dispatch(Redirect.Action.APP, '/')
      }
    })
  }, [authUser]);


  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Banner
            title="Your PayPal account was successfully linked."
            status="success"
            onDismiss={() => { }}
          />
        </Layout.Section>
        <Layout.Section>
          <Card title="Back to the future"
            primaryFooterAction={{ content: 'Synchronize historical orders', onAction: backsync, loading: isBackSyncing }}
            secondaryFooterActions={[{ content: "Skip", onAction: () => { redirect.dispatch(Redirect.Action.APP, '/') } }]}
          >
            <Card.Section>
              <Stack spacing="loose" vertical>
                <p>Do you want to upload your historical tracking numbers (up to 60 days ago) to Paypal? This operation is completely <i>free of charge</i>.</p>
              </Stack>
            </Card.Section>
          </Card>
        </Layout.Section>
      </Layout>
      {toastMarkup}

    </Page >
  )
};

export default withPlan(SetupBacksync);


