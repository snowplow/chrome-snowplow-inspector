import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec } from "../../types";
import { objHasProperty } from "../../util";

const REQUEST_TIMEOUT_MS = 5000;

export class StaticRegistry extends Registry {
  fields = {
    uri: {
      title: "Base URI",
      type: "url",
      description: "Base URL, path to root that contains /schemas directory",
      required: true,
      default: "http://iglucentral.com/",
    },
    manifestUri: {
      title: "Manifest URI",
      type: "url",
      description:
        "URI to a JSON object listing all the schemas served by this registry",
      required: false,
    },
  };

  private readonly cache: Map<IgluUri, ResolvedIgluSchema> = new Map();
  private readonly base: URL;
  private readonly manifest?: URL;

  constructor(spec: RegistrySpec) {
    super(spec);
    this.base = new URL(spec["uri"] || this.fields.uri.default);
    this.manifest = spec["manifestUri"] && new URL(spec["manifestUri"]);
  }

  private fetch(schemaPath: string): ReturnType<typeof fetch> {
    const ac = new AbortController();
    const id = setTimeout(ac.abort.bind(ac), REQUEST_TIMEOUT_MS);

    const opts: Partial<RequestInit> = {
      referrerPolicy: "origin",
      signal: ac.signal,
      credentials: this.base.username ? "include" : "omit",
      cache: "default",
    };

    const origins = [`*://${this.base.host}/*`];
    if (this.manifest) origins.push(`*://${this.manifest.host}/*`);

    return this.requestPermissions(...origins).then(() =>
      fetch(new URL(schemaPath, this.base).href, opts).then((resp) => {
        clearTimeout(id);
        return resp.ok
          ? resp
          : resp.status === 404
          ? Promise.reject("NOT_FOUND")
          : Promise.reject("HTTP_ERROR");
      })
    );
  }

  resolve(schema: IgluSchema) {
    if (this.cache.has(schema.uri())) {
      return Promise.resolve(this.cache.get(schema.uri())!);
    } else {
      return this.fetch(schema.uri().replace("iglu:", "schemas/"))
        .then((res) => res.json())
        .then((result) => {
          const resolved = schema.resolve(result, this);
          if (resolved) {
            this.cache.set(schema.uri(), resolved);
            this.lastStatus = "OK";
            return Promise.resolve(resolved);
          } else return Promise.reject();
        })
        .catch((reason) => {
          if (reason !== "NOT_FOUND") {
            this.lastStatus = "UNHEALTHY";
          }

          return Promise.reject(reason);
        });
    }
  }

  status() {
    this.lastStatus = this.lastStatus || "OK";
    return Promise.resolve(this.lastStatus);
  }

  parseManifest(): Promise<IgluSchema[]> {
    const fileListProps = ["tree", "files", "paths"];
    if (this.manifest) {
      return this.fetch(this.manifest.href)
        .then((res) => res.json())
        .catch((reason) => {
          this.lastStatus = "UNHEALTHY";
          this.opts.statusReason = reason || "Manifest error";
          return Promise.resolve(null);
        })
        .then((man) => {
          let list: unknown[] = [];

          if (typeof man === "object" && man) {
            if (Array.isArray(man)) {
              list = man;
            } else {
              for (const p of fileListProps) {
                if (man.hasOwnProperty(p) && Array.isArray(man[p])) {
                  list = list.concat(man[p]);
                }
              }
            }

            return Promise.resolve(
              list
                .filter(
                  (val: unknown): val is string | { path: string } =>
                    typeof val === "string" ||
                    (typeof val === "object" &&
                      !!val &&
                      objHasProperty(val, "path") &&
                      typeof val["path"] === "string")
                )
                .map((almostSchema): IgluUri | null => {
                  const maybeUri =
                    typeof almostSchema === "string"
                      ? almostSchema
                      : almostSchema.path;
                  const schemaparts =
                    /(([^\/]+)\/([^\/]+)\/jsonschema\/([\d+]-[\d+]-[\d+]))(\.json(schema)?)?$/i.exec(
                      maybeUri
                    );
                  return schemaparts && (("iglu:" + schemaparts[1]) as IgluUri);
                })
                .map((uri) => uri && IgluSchema.fromUri(uri))
                .filter((schema): schema is IgluSchema => schema !== null)
            );
          } else return Promise.resolve([]);
        });
    } else return Promise.resolve([]);
  }

  _walk() {
    return this.parseManifest()
      .then((claimed) => {
        const claimedUris = claimed.map(String);
        const cachedSchemas: IgluSchema[] = [];
        for (const cached of this.cache.values()) {
          if (!claimedUris.includes(cached.toString())) {
            cachedSchemas.push(cached);
          }
        }

        return claimed.concat(cachedSchemas);
      })
      .catch((reason) => {
        this.lastStatus = "UNHEALTHY";
        this.opts.statusReason = reason;
        return Promise.reject();
      });
  }
}
