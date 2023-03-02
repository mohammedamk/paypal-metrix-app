const { parsed: localEnv } = require("dotenv").config();
const { withSentryConfig } = require("@sentry/nextjs");

const webpack = require("webpack");
const apiKey = process.env.SHOPIFY_API_KEY;
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const env = process.env.ENV;
const paypalLoginUrl = process.env.PAYPAL_LOGIN_URL;

const moduleExports = {
  sentry: {
    disableServerWebpackPlugin: true,
  },
  env: {
    PAYPAL_LOGIN_URL: paypalLoginUrl,
    API_KEY: apiKey,
    PAYPAL_CLIENT_ID: paypalClientId,
    ENV: env,
    HOST: process.env.HOST,
  },

  webpack: (config) => {
    // Add ESM support for .mjs files in webpack 4
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
    });

    return config;
  },
};

const SentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  silent: true, // Suppresses all logs
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
};

module.exports = withSentryConfig(moduleExports, SentryWebpackPluginOptions);
