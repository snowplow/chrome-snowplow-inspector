import { h, Fragment, FunctionComponent } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { ModalOptions } from ".";
import { BaseModal } from "./BaseModal";

import { uuidv4, tryb64 } from "../../ts/util";
import { buildRegistry, Resolver } from "../../ts/iglu";
import { consoleAnalytics } from "../../ts/analytics";
import { request as requestPermissions } from "../../ts/permissions";
import type {
  OAuthIdentity,
  PipelineInfo,
  TestSuiteSpec,
} from "../../ts/types";
import { specFromTrackingScenarios } from "../../ts/util";

const prodExtIds = [
  "4166b542-f87d-4dbc-a6b1-34cb31a5b04e",
  "maplkdomeamdlngconidoefjpogkmljm",
];

const PROD_OAUTH_FLOW = "https://id.snowplowanalytics.com/";
const PROD_CONSOLE_API = "https://console.snowplowanalytics.com/api/msc/v1/";
const PROD_OAUTH_CLIENTID = "ljiYxb2Cs1gyN0wTWvfByrt1jdRaqxyM";

const NONPROD_OAUTH_FLOW = "https://next.id.snowplowanalytics.com/";
const NONPROD_CONSOLE_API =
  "https://next.console.snowplowanalytics.com/api/msc/v1/";
const NONPROD_OAUTH_CLIENTID = "xLciUpURW0s0SV5wF2kZ7WLQWkaa9fS9";

const CONSOLE_OAUTH_AUDIENCE = "https://snowplowanalytics.com/api/";
const CONSOLE_OAUTH_SCOPES = "openid profile";

const OAUTH_FLOW = prodExtIds.includes(chrome.runtime.id)
  ? PROD_OAUTH_FLOW
  : NONPROD_OAUTH_FLOW;

const CONSOLE_API = prodExtIds.includes(chrome.runtime.id)
  ? PROD_CONSOLE_API
  : NONPROD_CONSOLE_API;

const CONSOLE_OAUTH_CLIENTID = prodExtIds.includes(chrome.runtime.id)
  ? PROD_OAUTH_CLIENTID
  : NONPROD_OAUTH_CLIENTID;

type Organization = {
  id: string;
  name: string;
  domain: string;
  tier: string;
  tags: string[];
  essoDomain?: string;
  features: null | unknown;
};

export interface ConsoleSyncOptions extends ModalOptions {
  setIdentity: (_: OAuthIdentity) => void;
  resolver: Resolver;
}

const apiFetch = (path: string, opts?: Parameters<typeof fetch>[1]) =>
  fetch(new URL(path, CONSOLE_API), opts).then((r) =>
    r.ok ? r.json() : Promise.reject(r.statusText),
  );

const b64url = (s: string) =>
  btoa(s).replace(/[\+\/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);

export const ConsoleSync: FunctionComponent<ConsoleSyncOptions> = ({
  setModal,
  setIdentity,
  resolver,
}) => {
  const [doIgluProd, setDoIgluProd] = useState(true);
  const [doIgluDev, setDoIgluDev] = useState(true);
  const [doScenarios, setDoScenarios] = useState(true);
  const [doEnrichments, setDoEnrichments] = useState(true);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [enabledOrgs, setEnabledOrgs] = useState<Record<string, boolean>>({});
  const [authentication, setAuthentication] = useState<Partial<RequestInit>>(
    {},
  );
  const [id, setId] = useState<OAuthIdentity>();

  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<
    | "unauthenticated"
    | "authenticating"
    | "authenticated"
    | "working"
    | "done"
    | "error"
  >("unauthenticated");

  useEffect(() => consoleAnalytics("Sync Display"), []);

  const startFlow = useCallback(() => {
    consoleAnalytics("Auth Flow Start");
    setStatus("authenticating");
    const flowUrl = new URL("authorize", OAUTH_FLOW);

    const state = uuidv4();
    const nonce = b64url(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    );

    // OAuth Implicit Flow
    // https://auth0.com/docs/api/authentication#implicit-flow
    Object.entries({
      response_type: "id_token token",
      client_id: CONSOLE_OAUTH_CLIENTID,
      redirect_uri: chrome.identity.getRedirectURL(),
      scope: CONSOLE_OAUTH_SCOPES,
      audience: CONSOLE_OAUTH_AUDIENCE,
      nonce,
      state,
    }).forEach(([key, val]) => flowUrl.searchParams.set(key, val));

    chrome.identity.launchWebAuthFlow(
      { interactive: true, url: flowUrl.toString() },
      (responseUrl) => {
        if (responseUrl) {
          consoleAnalytics("Auth Flow Response");
          const response = new URL(responseUrl);
          const fragParams = new URLSearchParams(response.hash.slice(1));
          const access_token = fragParams.get("access_token");
          const id_token = fragParams.get("id_token");
          const token_type = fragParams.get("token_type");
          const respState = fragParams.get("state");

          if (
            respState !== state ||
            token_type !== "Bearer" ||
            !access_token ||
            !id_token
          ) {
            setStatus("error");
            setWarnings((warnings) => [
              ...warnings,
              "OAuth protocol failure failure during authentication",
            ]);
            consoleAnalytics("Auth Flow Invalid");
            return console.error(
              "auth failed",
              access_token,
              id_token,
              token_type,
            );
          }
          const [header, encIdentity, sig] = id_token.split(".");

          const decIdentity = tryb64(encIdentity);
          if (decIdentity === encIdentity) {
            setStatus("error");
            setWarnings((warnings) => [
              ...warnings,
              "Unable to process OAuth user identity",
            ]);
            consoleAnalytics("Auth Flow Identity Error");
            return console.error(
              "could not decode identity token",
              encIdentity,
            );
          }

          const identity: OAuthIdentity = JSON.parse(decIdentity);
          setIdentity(identity);
          consoleAnalytics("Auth Flow Complete");

          const authentication = {
            headers: { Authorization: `Bearer ${access_token}` },
          };

          apiFetch("organizations", authentication)
            .then((organizations) => {
              consoleAnalytics(
                "Organization Discovery",
                undefined,
                undefined,
                organizations.length,
              );
              setOrganizations(organizations);
              setAuthentication(authentication);
              setId(identity);
              setWarnings([]);
              setStatus("authenticated");
            })
            .catch((e) => {
              consoleAnalytics("Organization Discovery Failure");
              setStatus("error");
              setWarnings((warnings) => [
                ...warnings,
                "Unable to find any associated Organizations",
              ]);
              console.error(e);
            });
        } else {
          consoleAnalytics("Auth Flow Failure");
          setWarnings((warnings) => [
            ...warnings,
            "No OAuth redirect detected",
          ]);
          setStatus("unauthenticated");
        }
      },
    );
  }, []);

  const startSync = useCallback(
    (event: Event) => {
      event.preventDefault();
      setStatus("authenticating");
      const tasks: Promise<void>[] = [];

      consoleAnalytics(
        "Sync Begin",
        JSON.stringify({
          scenarios: doScenarios,
          enrichments: doEnrichments,
          igluDev: doIgluDev,
          igluProd: doIgluProd,
        }),
      );

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
          )
            .then((transformed) => {
              chrome.storage.local.get(
                {
                  testSuites: "[]",
                },
                ({ testSuites }) => {
                  consoleAnalytics(
                    "Scenario Import Success",
                    undefined,
                    undefined,
                    transformed.length,
                  );
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
            })
            .catch((e) => consoleAnalytics("Scenario Import Failure", "" + e)),
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
                  const keyName = `Snowplow Inspector - ${id!.name}`;

                  return Promise.all(
                    Object.entries(iglus).flatMap(
                      ([env, { endpoint, keys }]) => {
                        if (env === "dev" && !doIgluDev) return [];
                        if (env === "prod" && !doIgluProd) return [];

                        const existing = keys.find(
                          ({ name }) => name === keyName,
                        );

                        if (!existing) {
                          consoleAnalytics("Iglu Credential Create", env);
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
                            )
                              .catch((e) => {
                                console.warn(
                                  "failure creating iglue credentials",
                                  e,
                                );
                                consoleAnalytics(
                                  "Iglu Credential Create Failure",
                                  env,
                                  "" + e,
                                );

                                setWarnings((warnings) => [
                                  ...warnings,
                                  `Unable to create Iglu Credentials for ${org.name}. Contact an admin to get credentials and edit the registry manually.`,
                                ]);

                                return {
                                  key: {
                                    value:
                                      "00000000-0000-0000-0000-000000000000",
                                  },
                                };
                              })
                              .then(
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
                        } else {
                          consoleAnalytics("Iglu Credential Exists", env);
                          return [];
                        }
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
                consoleAnalytics(
                  "Pipeline Sync",
                  undefined,
                  undefined,
                  pipelines.length,
                );
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
        })
        .catch((reason) => {
          if (reason) setWarnings((warnings) => [...warnings, "" + reason]);
          setStatus("error");
        });
    },
    [authentication],
  );

  return (
    <BaseModal
      title="Synchronize with Console"
      onClose={setModal}
      onSubmit={startSync}
    >
      <section>
        {!organizations.length ? (
          <>
            <p>
              Synchronizing Snowplow Inspector with your Snowplow Console login
              enables the following functionality:
            </p>
            <ul>
              <li>
                Collect and display pipeline configuration such as enabled
                Enrichments for events sent to a pipeline
              </li>
              <li>
                Create Test Suites out of any configured Tracking Scenarios
              </li>
              <li>
                Import registry information for production and development
                (mini)
              </li>
            </ul>
          </>
        ) : (
          <>
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
                      disabled={status !== "authenticated"}
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
              For the above selected organizations, you can do any of the
              following:
            </p>
            <ul class="syncoptions">
              <li>
                <label>
                  <input
                    type="checkbox"
                    name="iglu-prod"
                    disabled={status !== "authenticated"}
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
                    disabled={status !== "authenticated"}
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
                    disabled={status !== "authenticated"}
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
                    disabled={status !== "authenticated"}
                    checked={doEnrichments}
                    onChange={({ currentTarget }) =>
                      setDoEnrichments(currentTarget.checked)
                    }
                  />
                  Display enrichment configuration for events
                </label>
              </li>
            </ul>
          </>
        )}
        {warnings.length ? (
          <>
            <p>Some errors occurred during the synchronization:</p>
            <ul>
              {warnings.map((msg) => (
                <li>{msg}</li>
              ))}
            </ul>
          </>
        ) : null}
        {status === "done" ? (
          <p>
            Synchronization Complete! You will need to restart DevTools for all
            changes to take effect.
          </p>
        ) : null}
      </section>
      <footer>
        {status === "unauthenticated" || status === "authenticating" ? (
          <button onClick={startFlow} disabled={status === "authenticating"}>
            Log In
          </button>
        ) : status === "authenticated" ? (
          <button>Synchronize</button>
        ) : status === "working" ? (
          <progress indeterminate />
        ) : status === "error" ? (
          <button onClick={() => setModal()}>Quit</button>
        ) : (
          <button onClick={() => setModal()}>Done</button>
        )}
      </footer>
    </BaseModal>
  );
};
