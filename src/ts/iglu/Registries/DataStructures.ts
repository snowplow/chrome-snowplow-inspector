import { IgluSchema } from "../";
import { Registry } from "./Registry";
import { RegistrySpec, RegistryStatus } from "../../types";
import { IgluUri, ResolvedIgluSchema } from "../IgluSchema";

const INSIGHTS_OAUTH_ENDPOINT = "https://id.snowplowanalytics.com/";
const INSIGHTS_OAUTH_AUDIENCE = "https://snowplowanalytics.com/api/";
const INSIGHTS_API_ENDPOINT = "https://console.snowplowanalytics.com/";

const REQUEST_TIMEOUT_MS = 5000;

type InsightsOauthResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type DataStructuresSchema = {
  hash: string;
  organizationId: string;
  vendor: IgluSchema["vendor"];
  name: IgluSchema["name"];
  format: IgluSchema["format"];
  description: string;
  meta: {
    schemaType: "event" | "entity";
    hidden: boolean;
    customData: object;
  };
  deployments: {
    version: IgluSchema["version"];
    patchLevel: number;
    contentHash: string;
    env: "DEV" | "PROD";
    ts: string;
    message: string;
    initiator: string;
  }[];
};

type DataStructuresMetaData = {
  hash: string;
  organizationId: string;
  description: string;
  deployments: Omit<DataStructuresSchema["deployments"][number], "version">[];
} & DataStructuresSchema["meta"];

export class DataStructuresRegistry extends Registry {
  fields = {
    clientId: {
      title: "OAuth Client ID",
      type: "text",
      description:
        "Insights Console password to requrest OAuth credentials for",
      required: true,
      pattern: "^\\w{32}$",
    },
    clientSecret: {
      title: "OAuth Client Secret",
      type: "password",
      description:
        "Insights Console password to requrest OAuth credentials for",
      required: true,
    },
    organizationId: {
      title: "Organization ID",
      type: "text",
      description: "Insights Console Organization UUID",
      required: true,
      pattern: "^[a-fA-F0-9-]{36}$",
    },
    oauthUsername: {
      title: "Insights Console Username",
      type: "email",
      description:
        "Insights Console username to requrest OAuth credentials for",
      required: true,
    },
    oauthPassword: {
      title: "Insights Console Password",
      type: "password",
      description:
        "Insights Console password to requrest OAuth credentials for",
      required: true,
    },
    dsApiEndpoint: {
      title: "API Endpoint",
      type: "url",
      description: "Primary Data Structures API endpoint",
      required: false,
      placeholder: INSIGHTS_API_ENDPOINT,
    },
    oauthApiEndpoint: {
      title: "OAuth Endpoint",
      type: "url",
      description: "OAuth authorization endpoint",
      required: false,
      placeholder: INSIGHTS_OAUTH_ENDPOINT,
    },
    oauthAudience: {
      title: "OAuth Audience",
      type: "text",
      description: "OAuth audience scope",
      required: false,
      placeholder: INSIGHTS_OAUTH_AUDIENCE,
    },
  };

  private readonly dsApiEndpoint: URL;

  private readonly oauthApiEndpoint: URL;
  private readonly oauthAudience: string;
  private readonly oauthUsername?: string;
  private readonly oauthPassword?: string;

  private readonly organizationId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private readonly cache: Map<IgluUri, ResolvedIgluSchema> = new Map();
  private accessToken?: string;
  private accessExpiry?: Date;

  private readonly metadata: Map<IgluUri, DataStructuresMetaData> = new Map();

  constructor(spec: RegistrySpec) {
    super(spec);

    this.dsApiEndpoint = new URL(
      spec["dsApiEndpoint"] || INSIGHTS_API_ENDPOINT
    );

    this.oauthApiEndpoint = new URL(
      spec["oauthApiEndpoint"] || INSIGHTS_OAUTH_ENDPOINT
    );
    this.oauthAudience = spec["oauthAudience"] || INSIGHTS_OAUTH_AUDIENCE;
    this.oauthUsername = spec["oauthUsername"];
    this.oauthPassword = spec["oauthPassword"];

    this.organizationId = spec["organizationId"];
    this.clientId = spec["clientId"];
    this.clientSecret = spec["clientSecret"];
  }

  private fetch(apiPath: string): ReturnType<typeof fetch> {
    return this.auth().then((headers) => {
      const ac = new AbortController();
      const id = setTimeout(ac.abort.bind(ac), REQUEST_TIMEOUT_MS);

      const opts: Partial<RequestInit> = {
        headers,
        referrerPolicy: "origin",
        signal: ac.signal,
      };

      return fetch(
        new URL(
          apiPath.replace(
            "/organizations/",
            `/organizations/${this.organizationId}/`
          ),
          this.dsApiEndpoint
        ).href,
        opts
      ).then((resp) => {
        clearTimeout(id);
        return resp.ok ? resp : Promise.reject("HTTP_ERROR");
      });
    });
  }

  private auth(): Promise<RequestInit["headers"]> {
    const now = new Date();
    if (this.accessToken && this.accessExpiry && now < this.accessExpiry) {
      return Promise.resolve({ Authorization: this.accessToken });
    }

    if (!this.clientId || !this.clientSecret || !this.organizationId)
      return Promise.reject("Missing credentials");

    const data = new URLSearchParams({
      audience: this.oauthAudience,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    if (this.oauthUsername) data.append("username", this.oauthUsername);
    if (this.oauthPassword) {
      data.append("password", this.oauthPassword);
      data.append("grant_type", "password");
    }

    const opts: Partial<RequestInit> = {
      method: "POST",
      body: data,
      referrerPolicy: "origin",
    };

    return this.requestPermissions(
      `${this.oauthApiEndpoint.origin}/*`,
      `${this.dsApiEndpoint.origin}/*`
    )
      .then(() =>
        fetch(new URL("oauth/token", this.oauthApiEndpoint).href, opts)
      )
      .then((resp) => (resp.ok ? resp.json() : Promise.reject("AUTH_ERROR")))
      .then((resp: InsightsOauthResponse) => {
        this.accessToken = `${resp.token_type} ${resp.access_token}`;
        this.accessExpiry = new Date(Date.now() + resp.expires_in);
        return { Authorization: this.accessToken };
      })
      .catch((reason) => {
        this.opts["statusReason"] = reason;
        this.lastStatus = "UNHEALTHY";
        return Promise.reject();
      });
  }

  private pickPatch(metadata: DataStructuresMetaData) {
    let candidate: DataStructuresMetaData["deployments"][number] | null = null;
    let patches = false;
    for (const version of metadata.deployments) {
      if (
        false ||
        !candidate ||
        candidate.patchLevel < version.patchLevel ||
        candidate.ts < version.ts ||
        (candidate?.env === "DEV" && version.env === "PROD")
      ) {
        patches =
          patches ||
          (!!candidate && candidate.contentHash !== version.contentHash);
        candidate = version;
      }
    }

    if (candidate && patches) {
      return "?env=" + candidate.env.toLowerCase();
    }

    return "";
  }

  resolve(schema: IgluSchema): Promise<ResolvedIgluSchema> {
    if (this.cache.has(schema.uri()))
      return Promise.resolve(this.cache.get(schema.uri())!);

    if (this.metadata.has(schema.uri())) {
      const md = this.metadata.get(schema.uri())!;
      const patchEnv = this.pickPatch(md);

      return this.fetch(
        `api/schemas/v1/organizations/schemas/${md.hash}/versions/${schema.version}${patchEnv}`
      )
        .then((resp) => resp.json())
        .then((data) => schema.resolve(data, this))
        .then((res) => {
          if (res) {
            this.cache.set(res.uri(), res);
            return res;
          } else return Promise.reject();
        });
    } else
      return this.walk().then(() =>
        this.metadata.has(schema.uri())
          ? this.resolve(schema)
          : Promise.reject()
      );
  }

  status() {
    this.lastStatus = this.lastStatus || "OK";

    return new Promise<RegistryStatus>((fulfil, fail) =>
      chrome.permissions.contains(
        {
          origins: [
            `${this.oauthApiEndpoint.origin}/*`,
            `${this.dsApiEndpoint.origin}/*`,
          ],
        },
        (allowed) => (allowed ? fulfil("OK") : fail("EXTENSION_ERROR"))
      )
    )
      .then(() => this.auth())
      .then(() => {
        const now = new Date();
        if (this.accessToken && this.accessExpiry && now < this.accessExpiry) {
          return "OK";
        } else {
          return Promise.reject("AUTH_EXPIRED");
        }
      })
      .catch((reason) => {
        this.opts["statusReason"] = reason;
        this.lastStatus = "UNHEALTHY";
        return Promise.resolve(this.lastStatus);
      });
  }

  walk() {
    return this.fetch("api/schemas/v1/organizations/schemas")
      .then((resp) => resp.json())
      .then((resp) => {
        if (Array.isArray(resp)) {
          const structures: DataStructuresSchema[] = resp;
          const catalog: IgluSchema[] = [];

          structures.forEach((struct) => {
            const { description, meta, hash, organizationId } = struct;
            if (organizationId !== this.organizationId) return;

            const { vendor, name, format, deployments } = struct;

            const versionInfo: Map<
              string,
              DataStructuresMetaData["deployments"][number][]
            > = new Map();

            deployments.forEach((dep) => {
              catalog.push(new IgluSchema(vendor, name, format, dep.version));

              const v: Omit<typeof dep, "version"> = Object.assign({}, dep, {
                version: undefined,
              });
              if (versionInfo.has(dep.version)) {
                versionInfo.get(dep.version)?.push(v);
              } else {
                versionInfo.set(dep.version, [v]);
              }
            });

            versionInfo.forEach((deployments, version) => {
              const s = new IgluSchema(vendor, name, format, version);
              const metadata: DataStructuresMetaData = {
                ...meta,
                description,
                hash,
                organizationId,
                deployments,
              };
              this.metadata.set(s.uri(), metadata);
            });
          });

          return catalog;
        } else return Promise.reject();
      });
  }
}
