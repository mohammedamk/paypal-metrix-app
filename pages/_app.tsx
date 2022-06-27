import ApolloClient from "apollo-boost";
import { ApolloProvider } from "react-apollo";
import App from "next/app";
import { AppProvider } from "@shopify/polaris";
import { ClientRouter, Provider, useAppBridge } from "@shopify/app-bridge-react";
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import { Redirect } from "@shopify/app-bridge/actions";
import "@shopify/polaris/dist/styles.css";
import translations from "@shopify/polaris/locales/en.json";
import React, { useEffect, useState } from "react";
import { AuthUserProvider, useAuth } from "providers/authProvider";

import Link from "routers/Link";
import Routes from "routers/Routes";
import AppFrame from "routers/AppFrame";
import { useRouter } from "next/dist/client/router";

import { NavigationProvider, useNavigation } from "providers/navProvider";
import Cookies from "js-cookie";

function userLoggedInFetch(app) {
  const fetchFunction = authenticatedFetch(app);

  return async (uri, options) => {
    const response = await fetchFunction(uri, options);

    if (
      response.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1"
    ) {
      const authUrlHeader = response.headers.get(
        "X-Shopify-API-Request-Failure-Reauthorize-Url"
      );

      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.APP, authUrlHeader || `/auth`);
      return null;
    }

    return response;
  };
}

function MyProvider(props) {
  const app = useAppBridge();
  const { signInWithToken, authUser } = useAuth()
  const router = useRouter()
  const authFetch = authenticatedFetch(app)

  const client = new ApolloClient({
    fetch: userLoggedInFetch(app),
    fetchOptions: {
      credentials: "include",
    },
  });


  useEffect(() => {
    if (!authUser) {
      authFetch('/api/auth/token').then(res => res.json().then(data => {
        if (data && data.token) {
          signInWithToken(data.token)
        }
      }))
    }
  }, [])


  useEffect(() => {

    let tidioScript = document.createElement('script');
    tidioScript.src = '//code.tidio.co/cdow3t6krpjeglerbe6sorqb0jxncqbh.js';
    document.body.appendChild(tidioScript);

  });


  useEffect(() => {
    let anyWindow = window as any
    anyWindow['_fs_is_outer_script'] = true;
    anyWindow['_fs_debug'] = false;
    anyWindow['_fs_host'] = 'fullstory.com';
    anyWindow['_fs_script'] = 'edge.fullstory.com/s/fs.js';
    anyWindow['_fs_org'] = '16N13N';
    anyWindow['_fs_namespace'] = 'FS';

    (function (m, n, e, t, l, o, g, y) {
      if (e in m) { if (m.console && m.console.log) { m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].'); } return; }
      g = m[e] = function (a, b, s) { g.q ? g.q.push([a, b, s]) : g._api(a, b, s); }; g.q = [];
      o = n.createElement(t); o.async = 1; o.crossOrigin = 'anonymous'; o.src = 'https://' + m['_fs_script'];
      y = n.getElementsByTagName(t)[0]; y.parentNode.insertBefore(o, y);
      g.identify = function (i, v, s) { g(l, { uid: i }, s); if (v) g(l, v, s) }; g.setUserVars = function (v, s) { g(l, v, s) }; g.event = function (i, v, s) { g('event', { n: i, p: v }, s) };
      g.anonymize = function () { g.identify(!!0) };
      g.shutdown = function () { g("rec", !1) }; g.restart = function () { g("rec", !0) };
      g.log = function (a, b) { g("log", [a, b]) };
      g.consent = function (a) { g("consent", !arguments.length || a) };
      g.identifyAccount = function (i, v) { o = 'account'; v = v || {}; v.acctId = i; g(o, v) };
      g.clearUserCookie = function () { };
      g.setVars = function (n, p) { g('setVars', [n, p]); };
      g._w = {}; y = 'XMLHttpRequest'; g._w[y] = m[y]; y = 'fetch'; g._w[y] = m[y];
      if (m[y]) m[y] = function () { return g._w[y].apply(this, arguments) };
      g._v = "1.3.0";
    })(anyWindow, document, anyWindow['_fs_namespace'], 'script', 'user');
  });

  const Component = props.Component;

  return (
    <ApolloProvider client={client}>
      <ClientRouter history={router} />
      <Component {...props} />
    </ApolloProvider>
  );
}


class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props;

    return (
      <AuthUserProvider>

        <AppProvider i18n={translations} linkComponent={Link as any} >

          <Provider
            config={{
              apiKey: process.env.API_KEY,
              host: pageProps.host,
              forceRedirect: true,
            }}
          >
            <NavigationProvider>
              <MyProvider Component={Component} {...pageProps} />
              <AppFrame />
            </NavigationProvider>
          </Provider>

        </AppProvider >


      </AuthUserProvider>
    );
  }
}

MyApp.getInitialProps = async ({ ctx }) => {
  return {
    pageProps: {
      host: ctx.query.host,
    }

  };
};

export default MyApp;
