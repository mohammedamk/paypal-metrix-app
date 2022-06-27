
import { Loading, Toast, useAppBridge } from "@shopify/app-bridge-react";
import { AccountConnection, Button, Caption, Card, DataTable, Frame, Heading, Icon, Layout, Navigation, Page, Stack, Subheading, TextContainer } from "@shopify/polaris";
import firebase from "../utils/firebase"
import fb from "firebase/app";
import React, { useCallback, useEffect, useState } from "react";

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useRouter } from "next/dist/client/router";
import { useAuth } from "providers/authProvider";
import { Redirect } from "@shopify/app-bridge/actions";
import { CircleTickMajor } from "@shopify/polaris-icons";
import { PLAN, PLAN_STATUS } from "types/enums";
import { useLazyQuery, useMutation } from "react-apollo";
import useApi from "hooks/useApi";
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import { gql } from "apollo-boost";
import { RECURRING_CREATE } from "mutations/get-subscription-url";
import { Shop } from "types/db";
import AsyncButton from "components/AsyncButton";


const Settings = () => {
  const app = useAppBridge()
  const redirect = Redirect.create(app)
  const api = useApi()
  const [loading, setLoading] = useState(false)
  const [shop, setShop] = useState<Shop | null>(null)
  const { authUser } = useAuth()
  const fetchFunc = authenticatedFetch(app)
  async function requestChargeConfirmation(plan: PLAN) {
    const res = await fetchFunc(`/api/shopify/getSubscriptionUrl?plan=${plan}`)
    const json = await res.json()
    const confirmationUrl = json.data.appSubscriptionCreate.confirmationUrl;
    redirect.dispatch(Redirect.Action.REMOTE, confirmationUrl)
  }

  async function fetchShop() {
    setLoading(true)
    const shopDoc = firebase.firestore.collection("shops").doc(authUser.uid);
    const shop = await shopDoc.get()
    setShop(shop.data() as Shop)
    setLoading(false)
  }
  function isCurrentPlan(plan: PLAN) {
    return shop.currentPlan && shop.currentPlan.status === PLAN_STATUS.ACTIVE && shop.currentPlan.plan === plan
  }

  useEffect(() => {
    if (!authUser)
      return
    fetchShop()
  }, [authUser])


  if (shop === null) { return <Loading></Loading> }

  const tickIcon = <Icon backdrop={true} source={CircleTickMajor} color="base" />

  const freeBtn = <AsyncButton disabled={isCurrentPlan("FREE")} onAsyncClick={async () => { await requestChargeConfirmation("FREE") }}>
  {shop.currentPlan ? isCurrentPlan("FREE") ? `Current Plan` : `Choose This Plan` : `Start Free Trial`}
  </AsyncButton>

  const microBtn = <AsyncButton disabled={isCurrentPlan("MICRO")} onAsyncClick={async () => { await requestChargeConfirmation("MICRO") }}>
  {shop.currentPlan ? isCurrentPlan("MICRO") ? `Current Plan` : `Choose This Plan` : `Start Free Trial`}
  </AsyncButton>

  const discoveryBtn = <AsyncButton disabled={isCurrentPlan("DISCOVERY")} onAsyncClick={async () => { await requestChargeConfirmation("DISCOVERY") }}>
  {shop.currentPlan ? isCurrentPlan("DISCOVERY") ? `Current Plan` : `Choose This Plan` : `Start Free Trial`}
  </AsyncButton>

  const adventureBtn = <AsyncButton disabled={isCurrentPlan("ADVENTURE")} onAsyncClick={async () => { await requestChargeConfirmation("ADVENTURE") }}>
  {shop.currentPlan ? isCurrentPlan("ADVENTURE") ? `Current Plan` : `Choose This Plan` : `Start Free Trial`}
  </AsyncButton>

  const heroBtn = <AsyncButton disabled={isCurrentPlan("HEROIC")} onAsyncClick={async () => { await requestChargeConfirmation("HEROIC") }}>
  {shop.currentPlan ? isCurrentPlan("HEROIC") ? `Current Plan` : `Choose This Plan` : `Start Free Trial`}
  </AsyncButton>

  const rows = [
    ['Monthly Price', '$9.99/month', '$29.99/month', '$49.99/month', '$59.99/month'],
    ['Historical Orders', tickIcon, tickIcon, tickIcon, tickIcon],
    ['Instant Synchronization', tickIcon, tickIcon, tickIcon, tickIcon],
    ['Synchronizations Per Month', 100, '1,499', '4,999', 'Unlimited'],
    ['', microBtn, discoveryBtn, adventureBtn, heroBtn]
  ];

  return (
    <Page title={shop && shop.currentPlan ? `` : `First, choose a plan`}>

      <Card>
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'text', 'text']}
          headings={['', 'Micro', 'Discovery', 'Adventure', 'Heroic']}
          rows={rows}
        />
      </Card>

    </Page>
  )
};

export default Settings;
