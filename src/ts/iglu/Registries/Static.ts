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
      description:
        "Base URL, path to root that contains /schemas directory. You probably want this to end in a /",
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
    disableCache: {
      title: "Disable Cache",
      type: "checkbox",
      description: "Do not cache schema results, always fetch the latest version",
      required: false,
    },
  };

  private readonly cache: Map<IgluUri, Promise<ResolvedIgluSchema>> = new Map();
  private readonly base: URL;
  private readonly manifest: URL;
  private readonly disableCache: boolean;

  constructor(spec: RegistrySpec) {
    super(spec);
    this.base = new URL(spec["uri"] || this.fields.uri.default);
    this.manifest = spec["manifestUri"]
      ? new URL(spec["manifestUri"])
      : new URL("schemas", this.base);

      this.disableCache = !!spec["disableCache"];
  }

  private fetch(schemaPath: string): ReturnType<typeof fetch> {
    const ac = new AbortController();
    const id = setTimeout(ac.abort.bind(ac), REQUEST_TIMEOUT_MS);

    const opts: Partial<RequestInit> = {
      referrerPolicy: "origin",
      signal: ac.signal,
      credentials: this.base.username ? "include" : "omit",
      cache: this.disableCache ? "no-store" : "default",
    };
    return fetch(new URL(schemaPath, this.base).href, opts)
      .catch((reason) => {
        if (
          reason instanceof TypeError &&
          /NetworkError|Failed to fetch/.test(reason.message)
        ) {
          const origins = [`*://${this.base.host}/*`];
          if (this.manifest) origins.push(`*://${this.manifest.host}/*`);
          return this.requestPermissions(...origins).then(() =>
            this.fetch(schemaPath),
          );
        } else return Promise.reject(reason.message);
      })
      .then((resp) => {
        clearTimeout(id);
        return resp.ok
          ? resp
          : resp.status === 404
            ? Promise.reject("NOT_FOUND")
            : Promise.reject("HTTP_ERROR");
      });
  }

  resolve(schema: IgluSchema) {
    if (!this.disableCache && this.cache.has(schema.uri())) {
      return this.cache.get(schema.uri())!;
    } else {
      if (this.vendorPrefixes && this.vendorPrefixes.length) {
        if (
          !this.vendorPrefixes.some((prefix) =>
            schema.vendor.startsWith(prefix),
          )
        ) {
          const mismatch = Promise.reject("PREFIX_MISMATCH");
          this.cache.set(schema.uri(), mismatch);
          return mismatch;
        }
      }

      const retrieve = this.fetch(schema.uri().replace("iglu:", "schemas/"))
        .then((res) => res.json())
        .then((result) => {
          const resolved = schema.resolve(result, this);
          if (resolved) {
            return Promise.resolve(resolved);
          } else return Promise.reject();
        })
        .catch((reason) => {
          if (reason !== "NOT_FOUND") {
            this.lastStatus = "UNHEALTHY";
          }

          return Promise.reject(reason);
        });

      this.cache.set(schema.uri(), retrieve);
      return retrieve;
    }
  }

  status() {
    this.lastStatus = this.lastStatus || "OK";
    return Promise.resolve(this.lastStatus);
  }

  parseManifest(): Promise<IgluSchema[]> {
    const fileListProps = ["tree", "files", "paths"];
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
                    typeof val["path"] === "string"),
              )
              .map((almostSchema): IgluUri | null => {
                const maybeUri =
                  typeof almostSchema === "string"
                    ? almostSchema
                    : almostSchema.path;
                const schemaparts =
                  /(([^\/]+)\/([^\/]+)\/jsonschema\/([\d+]-[\d+]-[\d+]))(\.json(schema)?)?$/i.exec(
                    maybeUri,
                  );

                if (schemaparts) {
                  return (
                    schemaparts[1].indexOf("iglu:") !== 0
                      ? "iglu:" + schemaparts[1]
                      : schemaparts[1]
                  ) as IgluUri;
                } else return schemaparts;
              })
              .map((uri) => uri && IgluSchema.fromUri(uri))
              .filter((schema): schema is IgluSchema => schema !== null),
          );
        } else return Promise.resolve([]);
      });
  }

  _walk() {
    const cached = Array.from(this.cache.values()).map((p) =>
      p.catch(() => null),
    );
    return Promise.all([this.parseManifest(), Promise.all(cached)])
      .then(([claimed, cached]) => {
        const claimedUris = claimed.map(String);
        const cachedSchemas: IgluSchema[] = [];
        for (const hit of cached) {
          if (hit && !claimedUris.includes(hit.toString())) {
            cachedSchemas.push(hit);
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
