import {
  SignalsCore,
  type SignalsCoreOptions,
  type SignalsCoreSandboxOptions,
  type SignalsFetchOptions,
  type SignalsFetchResponse,
} from "@snowplow/signals-core";
import type { OAuthResult } from "../../ts/types";

//@ts-ignore: intentional override of private field
export class SignalsClient extends SignalsCore {
  private override accessToken: string | undefined;

  constructor({
    login,
    ...params
  }: (SignalsCoreOptions | SignalsCoreSandboxOptions) & {
    login?: OAuthResult;
  }) {
    super(params);

    if (login && "apiKey" in params && !params.apiKey) {
      const headers = login.authentication.headers!;
      const authHeader =
        "Authorization" in headers ? headers["Authorization"] : undefined;
      const [_bearer, token] = authHeader?.split(" ") ?? ["", ""];
      this.accessToken = token;
    }
  }

  fetch(
    url: string,
    options: SignalsFetchOptions,
  ): Promise<SignalsFetchResponse> {
    return fetch(url, options);
  }
}

export type AttributeKey = {
  name: string;
  description: string | null;
  key: string;
  tags: null;
  owner: string | null;
  ttl: string | null;
  is_published: boolean;
};

export type AttributeGroup = {
  name: string;
  version: number;
  attribute_key: {
    name: string;
  };
  ttl: string;
  batch_source: string | null;
  online: boolean;
  offline: boolean;
  description: string | null;
  tags: null;
  owner: string;
  fields:
    | {
        name: string;
        description?: string | null;
        type: string;
      }[]
    | null;
  attributes: {
    name: string;
    description: string | null;
    type: string;
    tags: null;
    events: {
      name: string;
      vendor: string;
      version: string;
    }[];
    aggregation: string;
    property: string | null;
    criteria: unknown;
    period: string;
    default_value: unknown;
  }[];
  is_published: boolean;
  attribute_key_or_name: string;
  attribute_group_or_attribute_key_ttl: string;
  feast_name: string;
  full_name: string;
  stream_source_name: string | null;
};

export type InterventionInstance = {
  intervention_id: string;
  name: string;
  version: number;
  attributes?: Record<string, string>;
  target_attribute_key: {
    name: string;
    id: string;
  };
};

export type Criterion = {
  attribute: string;
  operator:
    | "="
    | "!="
    | "<"
    | ">"
    | "<="
    | ">="
    | "like"
    | "not like"
    | "rlike"
    | "not rlike"
    | "in"
    | "not in"
    | "is null"
    | "is not null";
  value: unknown;
};
export type Criteria =
  | Criterion
  | { all: Criteria[] }
  | { any: Criteria[] }
  | { none: Criteria[] };

export type InterventionDefinition = {
  name: string;
  version: number;
  description?: string;
  owner?: string;
  is_published: boolean;
  target_attribute_keys: { name: string }[];
  criteria: Criteria;
};

export type ReceivedIntervention = InterventionInstance & { received: Date };
