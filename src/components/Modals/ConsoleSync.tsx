import { h, Fragment, FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { ModalOptions } from ".";
import { BaseModal } from "./BaseModal";

import { apiFetch } from "../ConsoleStatus";
import { buildRegistry, Resolver } from "../../ts/iglu";
import { request as requestPermissions } from "../../ts/permissions";
import type {
  OAuthIdentity,
  PipelineInfo,
  TestSuiteSpec,
} from "../../ts/types";
import { specFromTrackingScenarios } from "../../ts/util";

export interface ConsoleSyncOptions extends ModalOptions {
  organizations: {
    id: string;
    name: string;
    domain: string;
    tier: string;
    tags: string[];
    essoDomain?: string;
    features: null | unknown;
  }[];
  identity: OAuthIdentity;
  authentication: {};
  resolver: Resolver;
}

export const ConsoleSync: FunctionComponent<ConsoleSyncOptions> = ({
  setModal,
  organizations,
  identity,
  authentication,
  resolver,
}) => {
  const [doIgluProd, setDoIgluProd] = useState(true);
  const [doIgluDev, setDoIgluDev] = useState(true);
  const [doScenarios, setDoScenarios] = useState(true);
  const [doEnrichments, setDoEnrichments] = useState(true);

  const [enabledOrgs, setEnabledOrgs] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState("idle");

  return (
    <BaseModal
      title="Synchronize with Console"
      onClose={setModal}
      onSubmit={(event) => {
        event.preventDefault();
        setStatus("working");
        const tasks: Promise<void>[] = [];

        if (doScenarios)
          tasks.push(
            Promise.all(
              organizations.flatMap((org) => {
                if (enabledOrgs[org.id] ?? true) {
                  return [
                    apiFetch(
                      `organizations/${org.id}/tracking-scenarios/v1`,
                      authentication,
                    ).then((results) =>
                      specFromTrackingScenarios(org.name, results.data),
                    ),
                  ];
                } else return [];
              }),
            ).then((transformed) => {
              chrome.storage.local.get(
                {
                  testSuites: "[]",
                },
                ({ testSuites }) => {
                  const existing = JSON.parse(testSuites);
                  const transformedNames = transformed.map((t) => t.name);
                  const nonConflicting = existing.filter(
                    (e: TestSuiteSpec) => !transformedNames.includes(e.name),
                  );
                  chrome.storage.local.set({
                    testSuites: JSON.stringify([
                      ...nonConflicting,
                      ...transformed,
                    ]),
                  });
                },
              );
            }),
          );

        if (doIgluDev || doIgluProd)
          tasks.push(
            Promise.all(
              organizations.map((org) =>
                apiFetch(
                  `organizations/${org.id}/resources/v1/iglus`,
                  authentication,
                ).then(
                  (
                    iglus: Record<
                      "prod" | "dev",
                      { endpoint: string; keys: { name: string }[] }
                    >,
                  ) => {
                    const keyName = `Snowplow Inspector - ${identity.name}`;

                    return Promise.all(
                      Object.entries(iglus).flatMap(
                        ([env, { endpoint, keys }]) => {
                          if (env === "dev" && !doIgluDev) return [];
                          if (env === "prod" && !doIgluProd) return [];

                          const existing = keys.find(
                            ({ name }) => name === keyName,
                          );

                          if (!existing) {
                            return [
                              apiFetch(
                                `organizations/${org.id}/resources/v1/iglus/${env}/keys`,
                                {
                                  ...authentication,
                                  method: "post",
                                  body: JSON.stringify({
                                    name: keyName,
                                    keyType: "ReadOnly",
                                  }),
                                },
                              ).then(
                                (keyDetails: {
                                  name: string;
                                  key: { value: string };
                                }) => ({
                                  name: `${org.name} (${env})`,
                                  uri: endpoint,
                                  apiKey: keyDetails.key.value,
                                }),
                              ),
                            ];
                          } else return [];
                        },
                      ),
                    );
                  },
                ),
              ),
            )
              .then((specs) => {
                requestPermissions(...specs.flat().map(({ uri }) => uri));
                return specs
                  .flat()
                  .map((spec) => buildRegistry({ kind: "iglu", ...spec }));
              })
              .then((newRegs) => {
                resolver.import(false, ...newRegs);
                return resolver.persist();
              }),
          );

        if (doEnrichments)
          tasks.push(
            Promise.all(
              organizations.flatMap((org) => {
                if (enabledOrgs[org.id] ?? true) {
                  return [
                    apiFetch(
                      `organizations/${org.id}/resources/v1`,
                      authentication,
                    ).then(
                      (resources: {
                        minis: {
                          id: string;
                          cleanEndpoint?: string;
                          cloudProvider: string;
                        }[];
                        pipelines: {
                          id: string;
                          name: string;
                          cloudProvider: string;
                        }[];
                      }) =>
                        Promise.all(
                          Object.entries(resources)
                            .flatMap(([resource, list]) =>
                              list.map((li) => ({ ...li, resource })),
                            )
                            .map((resource) =>
                              Promise.all([
                                apiFetch(
                                  `organizations/${org.id}/resources/v1/${resource.resource}/${resource.id}/configuration/enrichments`,
                                  authentication,
                                ).then(
                                  (
                                    enrichments: {
                                      id: string;
                                      filename: string;
                                      lastUpdate: string;
                                      enabled: boolean;
                                      content: unknown;
                                    }[],
                                  ) => ({
                                    ...resource,
                                    organization: org.id,
                                    organizationName: org.name,
                                    domain: org.domain,
                                    enrichments,
                                  }),
                                ),
                                "cleanEndpoint" in resource
                                  ? Promise.resolve([resource.cleanEndpoint!])
                                  : apiFetch(
                                      `organizations/${org.id}/resources/v1/${resource.resource}/${resource.id}/configuration/collector`,
                                      authentication,
                                    ).then(
                                      ({
                                        domains,
                                      }: {
                                        domains: {
                                          fallback?: string;
                                          cookieDomains?: string[];
                                          dnsDomains?: string[];
                                          collectorCname?: string[];
                                        };
                                      }) => {
                                        const found: string[] = [];
                                        if (domains.fallback)
                                          found.push(domains.fallback);
                                        if (
                                          domains.cookieDomains &&
                                          domains.cookieDomains.length
                                        )
                                          found.push(...domains.cookieDomains);
                                        if (
                                          domains.dnsDomains &&
                                          domains.dnsDomains.length
                                        )
                                          found.push(...domains.dnsDomains);
                                        if (
                                          domains.collectorCname &&
                                          domains.collectorCname.length
                                        )
                                          found.push(...domains.collectorCname);
                                        return found;
                                      },
                                    ),
                              ]).then(([enrich, domains]) => ({
                                ...enrich,
                                domains,
                              })),
                            ),
                        ),
                    ),
                  ];
                } else return [];
              }),
            ).then((orgResources) => {
              chrome.storage.local.get(
                {
                  pipelines: "[]",
                },
                ({ pipelines }) => {
                  const existing: PipelineInfo[] = JSON.parse(pipelines);
                  const syncedNames = orgResources
                    .flat()
                    .map((t) => [t.organization, t.id].join("/"));
                  const nonConflicting = existing.filter(
                    (e) =>
                      !syncedNames.includes([e.organization, e.id].join("/")),
                  );

                  const merged = [...nonConflicting, ...orgResources.flat()];
                  chrome.storage.local.set({
                    pipelines: JSON.stringify(merged),
                  });
                },
              );
            }),
          );

        Promise.all(tasks)
          .then(() => {
            setStatus("done");
            setModal();
          })
          .catch((reason) => {
            setStatus("error");
            setError(reason);
          });
      }}
    >
      <section>
        <p>Successfully authenticated with Snowplow Console!</p>
        <p>The following organizations were detected for your account:</p>
        <ul class="syncorgs">
          {organizations.map((org) => (
            <li>
              <label
                title={`Organization ID: ${org.id}\nTier: ${
                  org.tier
                }\nEnabled features:\n- ${org.tags.join("\n- ")}`}
              >
                <input
                  type="checkbox"
                  name={org.id}
                  disabled={status !== "idle"}
                  checked={enabledOrgs[org.id] ?? true}
                  onChange={({ currentTarget }) =>
                    setEnabledOrgs((before) => ({
                      ...before,
                      [org.id]: currentTarget.checked,
                    }))
                  }
                />
                {org.name} ({org.domain})
              </label>
            </li>
          ))}
        </ul>
        <p>
          For the above selected organizations, you can do any of the following:
        </p>
        <ul class="syncoptions">
          <li>
            <label>
              <input
                type="checkbox"
                name="iglu-prod"
                disabled={status !== "idle"}
                checked={doIgluProd}
                onChange={({ currentTarget }) =>
                  setDoIgluProd(currentTarget.checked)
                }
              />
              Import Schema Registries for production pipelines
            </label>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                name="iglu-dev"
                disabled={status !== "idle"}
                checked={doIgluDev}
                onChange={({ currentTarget }) =>
                  setDoIgluDev(currentTarget.checked)
                }
              />
              Import Schema Registries for development (Mini) pipelines
            </label>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                name="scenarios"
                disabled={status !== "idle"}
                checked={doScenarios}
                onChange={({ currentTarget }) =>
                  setDoScenarios(currentTarget.checked)
                }
              />
              Create Test Suites from Tracking Scenarios
            </label>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                name="enrichments"
                disabled={status !== "idle"}
                checked={doEnrichments}
                onChange={({ currentTarget }) =>
                  setDoEnrichments(currentTarget.checked)
                }
              />
              Display enrichment configuration for events
            </label>
          </li>
        </ul>
      </section>
      <footer>
        {status === "idle" ? (
          <button>Synchronize</button>
        ) : status === "working" ? (
          <progress indeterminate />
        ) : status === "error" ? (
          <>
            <p>An error occurred during synchronization...</p>
            {error && <p>Error details: {error}</p>}
            <button onClick={() => setModal()}>Oh well</button>
          </>
        ) : (
          <>
            <p>
              Synchronization Complete! You will need to restart DevTools for
              all changes to take effect.
            </p>
            <button onClick={() => setModal()}>Done</button>
          </>
        )}
      </footer>
    </BaseModal>
  );
};
