import {
  SignalsCore,
  type SignalsCoreOptions,
  type SignalsCoreSandboxOptions,
  type SignalsFetchOptions,
  type SignalsFetchResponse,
} from "@snowplow/signals-core";
import type { OAuthResult, SignalsInstall } from "../../ts/types";
import { version } from "../../../package.json";

//@ts-ignore: intentional override of private field
export class SignalsClient extends SignalsCore {
  private override accessToken: string | undefined;
  /** credentials the registry endpoints accept, fixed for this client's lifetime */
  private readonly registryAuth: HeadersInit | undefined;

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

    // TODO: can we force the creds to update if apiKey is defined?
    this.registryAuth = this.sandboxToken
      ? { Authorization: `Bearer ${this.sandboxToken}` }
      : login?.authentication.headers;
  }

  /**
   * Lists a registry resource. Always resolves to an array: `fetch` below
   * resolves for error statuses too, and those bodies parse as an object, which
   * would otherwise strand every caller that iterates the result.
   */
  getRegistry<T>(
    resource: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T[]> {
    const url = new URL(`${this.baseUrl}/api/v1/registry/${resource}/`);
    for (const [key, value] of Object.entries(params ?? {}))
      url.searchParams.set(key, String(value));

    // build options per request: fetch below mutates the headers it is handed
    const opts = this._getFetchOptions({ method: "GET" });
    Object.assign(opts.headers, this.registryAuth);

    return this.fetch(url.toString(), opts)
      .then((resp) =>
        resp.status >= 200 && resp.status < 300 ? resp.json() : [],
      )
      .then(
        (body) => (Array.isArray(body) ? (body as T[]) : []),
        () => [],
      );
  }

  fetch(
    url: string,
    options: SignalsFetchOptions,
  ): Promise<SignalsFetchResponse> {
    options.headers["X-Signals-Sdk-Name"] = `snowplow-inspector ${version}`;
    return fetch(url, {
      ...options,
      ...{ credentials: "omit" },
    });
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

/**
 * An agentic context definition; `event_log` in the Signals API.
 * Retrieved values come back via SignalsClient.getAgenticContext.
 */
export type AgenticContextDefinition = {
  name: string;
  version: number;
  description: string | null;
  owner: string | null;
  /** free-text agent instructions, returned alongside the buffer on read */
  prompt: string | null;
  /** for v1 the API requires this to be `domain_sessionid` */
  attribute_key: { name: string };
  events: {
    event: Record<string, unknown>;
    properties: Record<string, unknown>[];
  }[];
  max_events: number;
  max_age_seconds: number;
  is_published: boolean;
  has_published_version: boolean;
};

/** Everything discovered for a single Signals install. */
export type SignalsDefinition = {
  client: SignalsClient;
  info: SignalsInstall;
  keys: AttributeKey[];
  groups: AttributeGroup[];
  interventions: InterventionDefinition[];
  agenticContexts: AgenticContextDefinition[];
};
