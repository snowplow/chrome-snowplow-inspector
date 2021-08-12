import { default as m, Component } from "mithril";

import { ModalOptions } from ".";
import { buildRegistry, Registry, Resolver } from "../../ts/iglu";
import { objHasProperty, tryb64 } from "../../ts/util";
import { RegistrySpec } from "../../ts/types";

export interface ImportRegistriesOptions extends ModalOptions {
  resolver: Resolver;
}

const resolverSchema =
  "iglu:com.snowplowanalytics.iglu/resolver-config/jsonschema/1";

let error: string | undefined = undefined;
let results: Registry[] | null = null;

const parseResolverConfig = (input: string) => {
  const text = tryb64(input);
  const json: unknown = JSON.parse(text);
  if (typeof json !== "object" || !json)
    throw Error("Couldn't parse config as object");
  if (!objHasProperty(json, "schema"))
    throw Error("Couldn't parse config as object");
  if (typeof json["schema"] !== "string")
    throw Error("Missing resolver-config schema");
  if (json["schema"].indexOf(resolverSchema) !== 0)
    throw Error("Invalid resolver-config schema");
  if (!objHasProperty(json, "data"))
    throw Error("No data payload in resolver-config");
  if (typeof json["data"] !== "object" || !json["data"])
    throw Error("Invalid data payload in resolver-config");
  if (
    !objHasProperty(json["data"], "repositories") ||
    !Array.isArray(json["data"]["repositories"])
  )
    throw Error("Invalid repositories in resolver-config");

  const imported: RegistrySpec[] = [];
  for (const repo of json["data"]["repositories"] as unknown[]) {
    const spec: RegistrySpec = {
      name: "Imported Registry",
      kind: "local",
    };

    if (typeof repo !== "object" || !repo)
      throw Error("Repositories element not an object");
    if (!objHasProperty(repo, "connection"))
      throw Error("Repositories element missing required property: connection");
    const conn = repo["connection"];
    if (typeof conn === "object" && conn) {
      if (objHasProperty(conn, "http")) {
        if (typeof conn["http"] !== "object" || !conn["http"])
          throw Error("Invalid Repository HTTP connection");
        if (
          !objHasProperty(conn["http"], "uri") ||
          typeof conn["http"]["uri"] !== "string"
        )
          throw Error("HTTP connection URI missing");
        spec.kind = "static";
        spec.uri = conn["http"]["uri"];
        if (
          objHasProperty(conn["http"], "apikey") &&
          typeof conn["http"]["apikey"] === "string"
        ) {
          spec.kind = "iglu";
          spec.apikey = conn["http"]["apikey"];
        }
      } else if (objHasProperty(conn, "embedded")) {
        continue;
      } else {
        throw Error("Connection object must be embedded or http");
      }
    }

    if (!objHasProperty(repo, "name") || typeof repo["name"] !== "string")
      throw Error("Repositories element missing required property: name");
    spec.name = repo["name"];
    if (
      objHasProperty(repo, "priority") &&
      typeof repo["priority"] === "number"
    )
      spec.priority = repo["name"];
    if (
      objHasProperty(repo, "vendorPrefixes") &&
      typeof repo["vendorPrefixes"] === "object" &&
      Array.isArray(repo["vendorPrefixes"])
    )
      spec.vendorPrefixes = repo["vendorPrefixes"];

    imported.push(spec);
  }

  return imported.map(buildRegistry);
};

export const ImportRegistries: Component<ImportRegistriesOptions, {}> = {
  view: ({ attrs: { setModal, resolver } }) =>
    m("div.modal.is-active.registry-import", [
      m("div.modal-background", { onclick: () => setModal() }),
      m("div.modal-card", [
        m("header.modal-card-head", [
          m("p.modal-card-title", "Import Resolver Configuration"),
          m("button.delete", {
            onclick: () => setModal(),
          }),
        ]),
        m("section.modal-card-body", [
          m(
            "p",
            "Enter the ",
            m(
              "a",
              {
                target: "_blank",
                href: "https://docs.snowplowanalytics.com/docs/pipeline-components-and-applications/iglu/iglu-resolver/",
              },
              m("code", "Resolver-Config")
            ),
            " configuration used in your pipeline to register all the Registries used by your pipeline."
          ),
          m("textarea", {
            class: "resolver-import",
            oninput: (event: InputEvent) => {
              if (event.target instanceof HTMLTextAreaElement) {
                results = null;
                if (event.target.value) {
                  try {
                    results = parseResolverConfig(event.target.value);
                  } catch (e) {
                    error = e.message;
                  }
                }
              }
            },
          }),
          error && m("p.error", error),
          results
            ? m(
                "select[disabled][multiple]",
                { size: 5 },
                results?.map((r) => m(r))
              )
            : undefined,
        ]),
        m(
          "footer.modal-card-foot",
          m(
            "button.button",
            {
              onclick: () => {
                let p = Promise.resolve();
                if (results) {
                  resolver.import(false, ...results);
                  p = resolver.persist();
                }

                p.then(() => setModal());
              },
            },
            "Save Registries"
          )
        ),
      ]),
    ]),
};
