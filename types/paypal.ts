export type PaypalInitialTokenRes = {
  scope: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  nonce: string;
};
export type PaypalRefreshTokenRes = {
  token_type: string;
  expires_in: number;
  access_token: string;
  errors?: PayPalError[];
};

export type PaypalIdentityRes = {
  user_id: string;
  name: string;
  given_name: string;
  family_name: string;
  payer_id: string;
  address: {
    street_address: string;
    locality: string;
    region: string;
    postal_code: string;
    country: string;
  };
  verified_account: string;
  emails?:
    | {
        value: string;
        primary: boolean;
      }[]
    | null;
};

export type PaypalTracking = {
  tracking_number: string;
  tracking_company: string;
};

export type PaypalTracker = {
  transaction_id: string;
  tracking_number: string;
  status: string;
  carrier: string;
  carrier_name_other?: string;
};

export type PaypalTrackerReq = {
  trackers: PaypalTracker[];
};

export type PaypalTrackerRes = {
  tracker_identifiers: {
    transaction_id: string;
    tracking_number: string;
    links: [
      {
        href: string; //Link to the tracker on paypal
      }
    ];
  };
  errors?: PayPalError[];
};

export type PaypalCreds = {
  token: string;
  refreshToken: string;
};

export interface PayPalError {
  readonly name: string;
  readonly message: string;
  debug_id: string;
  readonly details?: ErrorDetails[];
  readonly information_link?: string;
}

export type CallbackFunction<T> = (err: SDKError, response: T) => any;

export interface SDKError {
  httpStatusCode: number;
  message: string;
  response: PayPalError;
  response_stringified?: string | undefined;
  stack: string;
}

export interface ErrorDetails {
  readonly field: string;
  readonly value: string;
  readonly issue: string;
  readonly description: string;
}

export enum ShippingStatus {
  SHIPPED,
  ON_HOLD,
  DELIVERED,
  CANCELLED,
}
