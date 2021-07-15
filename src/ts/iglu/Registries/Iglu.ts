import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, IgluUri } from "../IgluSchema";
import { RegistrySpec, RegistryStatus } from "../../types";

export class IgluRegistry extends Registry {
  private manifest: Map<string, IgluSchema> = new Map();

  private readonly base: URL;
  private readonly apiKey?: string;
  private lastStatus?: RegistryStatus;

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

  resolve(schema: IgluSchema) {
    return this.fetch(schema.uri().replace("iglu:", "api/schemas/"))
      .then((res) => res.json())
      .catch(() => {
        this.lastStatus = "UNHEALTHY";
        return Promise.reject();
      })
      .then((result) => {
        const resolved = schema.resolve(result, this);
        return resolved ? Promise.resolve(resolved) : Promise.reject();
      });
  }

  status() {
    const last = this.lastStatus;
    let undefined;

    switch (last) {
      case "UNHEALTHY":
        this.lastStatus = undefined;
      // fall through
      case "OK":
        return Promise.resolve(last);
      case undefined:
        return new Promise<RegistryStatus>((fulfil, fail) =>
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
            Object.assign(this.opts, json);
            return "OK";
          })
          .catch((reason) => {
            this.opts["statusReason"] = reason;
            this.lastStatus = "UNHEALTHY";
            return Promise.resolve(this.lastStatus);
          });
    }
  }

  walk() {
    return this.fetch("api/schemas")
      .then((resp) => resp.json())
      .then((data) => {
        if (Array.isArray(data)) {
          return data
            .map(IgluSchema.fromUri)
            .filter((s): s is IgluSchema => s !== null);
        } else return Promise.reject();
      });
  }
}
