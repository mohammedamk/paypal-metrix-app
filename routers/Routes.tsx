import React from "react";
import { withRouter, Switch, Route } from "react-router-dom";
import { ClientRouter, RoutePropagator } from "@shopify/app-bridge-react";
import Settings from "pages/settings";
import Index from "pages";

function Routes(props) {
  const { history, location } = props;


  return (
    <>
      <ClientRouter history={history} />
      <RoutePropagator location={location} />
      <Switch>
        <Route path="/settings">
          <Settings />
        </Route>
        <Route path="/">
          <Index />
        </Route>
      </Switch>
    </>
  );
}

export default withRouter(Routes);
