import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, IgluUri, RegistrySpec, RegistryStatus } from "../../types";

export class IgluRegistry extends Registry {
  private manifest: Map<string, IgluSchema> = new Map();

  private readonly base: URL;
  private readonly apiKey?: string;
  private lastStatus?: RegistryStatus;

  private details?: {
    version: string;
    authInfo?: {
      vendor: string;
      schema: string | null;
      key: string[];
    };
    database?: string;
    schemaCount: number;
    debug: boolean;
    patchesAllowed: boolean;
  };

  constructor(spec: RegistrySpec) {
    super(spec);

    this.base = new URL(spec["uri"]);
    this.apiKey = spec["apiKey"];
  }

  private fetch(apiPath: string): ReturnType<typeof fetch> {
    const opts: Partial<RequestInit> = {
      headers: this.apiKey ? { apikey: this.apiKey } : undefined,
      referrerPolicy: "origin",
    };

    return fetch(new URL(apiPath, this.base).href, opts).then((resp) =>
      resp.ok ? resp : Promise.reject("HTTP_ERROR")
    );
  }

  resolve(uri: IgluUri) {}

  status() {
    return this.lastStatus
      ? Promise.resolve(this.lastStatus)
      : new Promise<RegistryStatus>((fulfil, fail) =>
          chrome.permissions.contains(
            { origins: [`*://${this.base.host}/*`] },
            (allowed) => (allowed ? fulfil("OK") : fail("EXTENSION_ERROR"))
          )
        )
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
            this.details = json;
            return "OK";
          });
  }

  walk() {
    return this.fetch("api/schemas").then((resp) => resp.json());
  }

  view() {
    return m("p", "Iglu Registry");
  }
}
