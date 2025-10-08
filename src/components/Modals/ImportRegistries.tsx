import { h, type FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import type { ModalOptions } from ".";
import { BaseModal } from "./BaseModal";
import { buildRegistry, type Registry, Resolver } from "../../ts/iglu";
import { RegistryDetail } from "../SchemaManager/RegistryDetail";
import { objHasProperty, tryb64 } from "../../ts/util";
import type { RegistrySpec } from "../../ts/types";

export interface ImportRegistriesOptions extends ModalOptions {
  resolver: Resolver;
}

const resolverSchema =
  "iglu:com.snowplowanalytics.iglu/resolver-config/jsonschema/1";

const parseResolverConfig = (input: string) => {
  let json: unknown;
  try {
    json = JSON.parse(input);
  } catch {
    json = JSON.parse(tryb64(input));
  }
  if (typeof json !== "object" || !json)
    throw Error("Couldn't parse config as object");
  if (!objHasProperty(json, "schema"))
    throw Error("Couldn't parse config as Self Describing JSON");
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

export const ImportRegistries: FunctionComponent<ImportRegistriesOptions> = ({
  setModal,
  resolver,
}) => {
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<Registry[]>();

  return (
    <BaseModal title="Import Resolver Configuration" onClose={setModal}>
      <section class="modal-card-body">
        <p>
          Enter the{" "}
          <a
            target="_blank"
            href="https://docs.snowplowanalytics.com/docs/pipeline-components-and-applications/iglu/iglu-resolver/"
          >
            <code>Resolver-Config</code>
          </a>{" "}
          configuration used in your pipeline to register all the Registries
          used by your pipeline.
        </p>
        <textarea
          class="textarea resolver-import"
          rows={8}
          onInput={(e) => {
            const target = e.currentTarget;
            try {
              setResults(parseResolverConfig(target.value));
              setError(undefined);
            } catch (e) {
              setError(e instanceof Error ? e.message : "" + e);
            }
          }}
        />
        {error && <p class="error">{error}</p>}
        {results && (
          <select disabled multiple size={5}>
            {results.map((r) => (
              <RegistryDetail registry={r} />
            ))}
          </select>
        )}
      </section>
      <footer class="modal-card-foot">
        <button
          class="button"
          onClick={() => {
            if (results) {
              resolver.import(false, ...results);
              resolver.persist().then(() => setModal());
            } else {
              setModal();
            }
          }}
        >
          Save Registries
        </button>
      </footer>
    </BaseModal>
  );
};
