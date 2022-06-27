
import { Loading, useAppBridge } from "@shopify/app-bridge-react";
import { Badge, Banner, Card, ChoiceList, DataTable, Filters, Heading, Link, Page, Stack } from "@shopify/polaris";
import _ from "lodash"
import { useRouter } from "next/dist/client/router";
import { Redirect } from '@shopify/app-bridge/actions';

import React, { useCallback, useEffect, useState } from "react";
import firebase from "../utils/firebase"

import { useAuth } from "providers/authProvider";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ORDER_STATUS } from "types/enums";
import { AppOrder } from "types/db";
import withPlanAndLogin from "hocs/withPlanAndLogin";
import moment from "moment";
import { getPlanLimits } from "utils/plans";
import { useNavigation } from "../providers/navProvider";
import { AppLink } from '@shopify/app-bridge/actions';

const Index = () => {
  const { authUser } = useAuth()
  const navMenu = useNavigation()
  const router = useRouter()

  const app = useAppBridge()
  const [alerts, setAlerts] = useState([])
  const [status, setStatus] = useState<ORDER_STATUS[]>([]);
  const [orders, setOrders] = useState<AppOrder[]>([])
  const [queryValue, setQueryValue] = useState(null)
  const [planLimits, setPlanLimits] = useState(0)
  const [monthlyUsage, setMonthlyUsage] = useState(0)
  const [groupedByDayOrders, setGroupedByDayOrders] = useState<Array<{ day: string, orders: number }>>()

  const redirect = Redirect.create(app)

  const handleFiltersQueryChange = useCallback(
    (value) => { setQueryValue(value) },
    [],
  );
  const handleQueryValueRemove = useCallback(() => { setQueryValue(null) }, []);
  const handleStatusChange = useCallback(
    (value) => setStatus(value),
    [],
  );
  const handleStatusRemove = useCallback(() => setStatus([]), []);
  const handleFiltersClearAll = useCallback(() => {
    handleStatusRemove();
    handleQueryValueRemove()
  }, [
    handleStatusRemove,
    handleQueryValueRemove
  ]);

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: 'Pending', value: ORDER_STATUS.PENDING },
            { label: 'Processed', value: ORDER_STATUS.PROCESSED },
            { label: 'Failed', value: ORDER_STATUS.FAILED },
          ]}
          selected={status || []}
          onChange={handleStatusChange}
          allowMultiple
        />
      ),
      shortcut: true,
    }]

  const appliedFilters = [];
  if (!(status.length === 0)) {
    const key = 'status';
    appliedFilters.push({
      key,
      label: status.map(val => `Tracking is ${val}`).join(', '),
      onRemove: handleStatusRemove
    });
  }

  async function connect() {
    redirect.dispatch(Redirect.Action.REMOTE, `${process.env.PAYPAL_LOGIN_URL}/connect/?flowEntry=static&client_id=${process.env.PAYPAL_CLIENT_ID}&response_type=code&scope=openid profile email https://uri.paypal.com/services/paypalattributes https://uri.paypal.com/services/disputes/read-seller https://uri.paypal.com/services/disputes/update-seller https://uri.paypal.com/services/shipping/trackers/readwrite&redirect_uri=https://${process.env.HOST}/api/paypal/auth/callback?state=${authUser.uid}`)
  }

  async function fetchOrders() {
    const ordersCollection = await firebase.firestore.collection("shops").doc(authUser.uid).collection("orders").where("createdAt", '>=', moment().startOf('month').toDate()).orderBy('createdAt', 'desc').get()
    setMonthlyUsage(ordersCollection.docs.filter(doc => doc.data().historical === false).length)
    const orders = ordersCollection.docs.map<AppOrder>(doc => {
      return {
        createdAt: doc.data().createdAt,
        synchronizedAt: doc.data().synchronizedAt,
        trackingNumbers: doc.data().trackingNumbers,
        status: doc.data().status,
        shopifyId: doc.data().shopifyId,
        name: doc.data().name
      }
    })
    setOrders(orders)
    const grouped: Array<{ day: string, orders: Array<AppOrder> }> = []
    for (const order of orders.filter(o => o.status === ORDER_STATUS.PROCESSED)) {
      const day = Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(order.synchronizedAt.toDate())

      const foundIndex = grouped.findIndex(g => g.day == day)
      if (foundIndex > -1) {
        grouped[foundIndex].orders = [...grouped[foundIndex].orders, order]
      } else {
        grouped.push({ day: day, orders: [order] })

      }

    }
    const firstDayOfMonth = moment().startOf('month')
    const today = moment()
    const days: Array<{ day: string, orders: number }> = []
    const sortedGrouped = grouped.sort((a, b) => new Date(a.day).valueOf() - new Date(b.day).valueOf())
    for (let day = firstDayOfMonth; day <= today; day = day.add(1, 'day')) {
      const index = sortedGrouped.findIndex(o => moment(o.day).isSame(day, 'day'))
      days.push({ day: day.format('MMM, DD'), orders: index > -1 ? sortedGrouped[index].orders.length : 0 })
    }

    setGroupedByDayOrders(days)
    setOrders(orders)


  }
  useEffect(() => {
    if (!navMenu) {
      return
    }
    const link = navMenu.children.find((c: AppLink.AppLink) => c.destination === router.pathname) as AppLink.AppLink
    navMenu.set({ active: link })
  }, [router])
  useEffect(() => {
    if (!authUser) {
      return
    }

    fetchOrders()

    firebase.firestore.collection("shops").doc(authUser.uid).get().then(shop => {
      if (!shop.data().currentPlan) {
        return redirect.dispatch(Redirect.Action.APP, '/plans')
      }
      setPlanLimits(getPlanLimits(shop.data().currentPlan.plan))
      if (!shop.data().paypalToken) {
        setAlerts([...alerts, <Banner
          title="No PayPal account is linked"
          action={{ content: 'Link a PayPal account', onAction: async () => { await connect() } }}
          status="warning"

        ><p>Automatic synchronization is disabled.</p></Banner>])
      }
    })




  }, [authUser])


  if (!groupedByDayOrders) {
    return <Loading></Loading>
  }

  return (
    <Page title="Dashboard">
      <Stack vertical>
        {alerts}
        {monthlyUsage >= planLimits && planLimits !== 0 && <Banner
          title="You reached the limits of your plan"
          action={{ content: 'Upgrade', onAction: () => { redirect.dispatch(Redirect.Action.APP, '/plans') } }}
          status='warning'

        ><p>Automatic synchronization is disabled.</p></Banner>}
        <Card sectioned>
          <Heading>Monthly report</Heading>
          <p>Synchronized orders.</p>

          <Card.Section fullWidth={false}>
            <AreaChart style={{ margin: "auto" }} width={600} height={300} data={groupedByDayOrders}>

              <defs>
                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5ABEE8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#5ABEE8" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip />
              <Area type="monotone" dataKey="orders" stroke="#5ABEE8" fillOpacity={1} fill="url(#colorUv)" />




            </AreaChart>
          </Card.Section>


        </Card>

        <Card>
          <Card.Section>
            <Filters
              queryValue={queryValue}
              filters={filters}
              appliedFilters={appliedFilters}
              onQueryChange={handleFiltersQueryChange}
              onQueryClear={handleQueryValueRemove}
              onClearAll={(handleFiltersClearAll)}
            />
          </Card.Section>
          <DataTable

            columnContentTypes={[
              'text',
              'text',
              'text',
              'text',
              'text'
            ]}
            headings={[
              'Name',
              'Tracking Number',
              'Company',
              'Status',
              'Sync Date'
            ]}
            rows={orders.filter((o) => queryValue == null || o.name.toLowerCase().indexOf(queryValue.toLowerCase()) > -1 || o.trackingNumbers.findIndex(t => t.trackingCompany.toLowerCase().indexOf(queryValue.toLowerCase()) > -1) > -1).filter((a) => status.length == 0 || status.includes(a.status)).map(o => {

              return [<Link onClick={() => { redirect.dispatch(Redirect.Action.ADMIN_SECTION, { name: Redirect.ResourceType.Order, resource: { id: o.shopifyId.toString() } }) }}>{o.name}</Link>, o.trackingNumbers[0].trackingNumber, o.trackingNumbers[0].trackingCompany, getStatusBadge(o.status), o.synchronizedAt ? moment(o.synchronizedAt.toDate()).format('MMM DD') : 'N/A']
            })}

          />
        </Card>
      </Stack>




    </Page>
  )
};

export default withPlanAndLogin(Index);


function getStatusBadge(status: ORDER_STATUS) {
  let statusBadge = null
  switch (status) {
    case ORDER_STATUS.PENDING:
      statusBadge = <Badge status="new">Pending</Badge>
      break;
    case ORDER_STATUS.PROCESSING:
      statusBadge = <Badge status="info">Processing</Badge>
      break;
    case ORDER_STATUS.FAILED:
      statusBadge = <Badge status="critical">Failed</Badge>
      break;
    case ORDER_STATUS.PROCESSED:
      statusBadge = <Badge status="success">Processed</Badge>
      break;
    case ORDER_STATUS.INSUFFICIENT_CREDITS:
      statusBadge = <Badge status='attention'>Plan Limits Reached</Badge>
      break;
  }

  return statusBadge
}

