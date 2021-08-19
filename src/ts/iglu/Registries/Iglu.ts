import { Registry } from ".";
import { IgluUri, IgluSchema, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec, RegistryStatus } from "../../types";

const REQUEST_TIMEOUT_MS = 5000;

export class IgluRegistry extends Registry {
  fields = {
    uri: {
      title: "Iglu API Endpoint",
      type: "url",
      description: "Iglu URI, usually ending in /endpoint",
      required: true,
      default: "http://example.com/api",
    },
    apiKey: {
      title: "Iglu API Key",
      type: "password",
      description:
        "API key, required to access non-public schemas in the registry",
      required: false,
      pattern: "^[a-fA-F0-9-]{36}$",
    },
  };

  private readonly cache: Map<IgluUri, ResolvedIgluSchema> = new Map();
  private readonly base: URL;
  private readonly apiKey?: string;

  constructor(spec: RegistrySpec) {
    super(spec);

    this.base = new URL(spec["uri"] || this.fields.uri.default);
    this.apiKey = spec["apiKey"];
  }

  private fetch(apiPath: string): ReturnType<typeof fetch> {
    const ac = new AbortController();
    const id = setTimeout(ac.abort.bind(ac), REQUEST_TIMEOUT_MS);

    const opts: Partial<RequestInit> = {
      headers: this.apiKey ? { apikey: this.apiKey } : undefined,
      referrerPolicy: "origin",
      signal: ac.signal,
      cache: "no-cache",
    };

    return fetch(new URL(apiPath, this.base).href, opts).then((resp) => {
      clearTimeout(id);
      return resp.ok ? resp : Promise.reject("HTTP_ERROR");
    });
  }

  resolve(schema: IgluSchema) {
    if (this.cache.has(schema.uri()))
      return Promise.resolve(this.cache.get(schema.uri())!);

    return this.fetch(schema.uri().replace("iglu:", "api/schemas/"))
      .then((res) => res.json())
      .catch(() => {
        this.lastStatus = "UNHEALTHY";
        return Promise.reject();
      })
      .then((result) => {
        const resolved = schema.resolve(result, this);
        if (resolved) {
          this.cache.set(resolved.uri(), resolved);
          this.lastStatus = "OK";
          return Promise.resolve(resolved);
        } else return Promise.reject();
      });
  }

  status() {
    this.lastStatus = this.lastStatus || "OK";

    return this.requestPermissions(`*://${this.base.host}/*`)
      .then(() => this.fetch("api/meta/health").then((resp) => resp.text()))
      .then((text) =>
        text === "OK"
          ? this.fetch("api/meta/health/db").then((resp) => resp.text())
          : Promise.reject("REGISTRY_ERROR")
      )
      .then((text) =>
        text === "OK"
          ? this.fetch("api/meta/server").then((resp) => resp.json())
          : Promise.reject("REGISTRY_DB_ERROR")
      )
      .then<RegistryStatus>((json) => {
        Object.assign(this.opts, json);
        return "OK";
      })
      .catch((reason) => {
        this.opts["statusReason"] = reason;
        this.lastStatus = "UNHEALTHY";
        return Promise.resolve(this.lastStatus);
      });
  }

  _walk() {
    return this.fetch("api/schemas")
      .then((resp) => resp.json())
      .then((data) => {
        if (Array.isArray(data)) {
          return data
            .map(IgluSchema.fromUri)
            .filter((s): s is IgluSchema => s !== null);
        } else {
          this.lastStatus = "UNHEALTHY";
          return Promise.reject();
        }
      });
  }
}
