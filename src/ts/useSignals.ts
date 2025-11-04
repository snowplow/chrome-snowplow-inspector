import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";

import { consoleAnalytics } from "./analytics";
import { buildRegistry } from "./iglu";
import { apiFetch, CONSOLE_API } from "./oauth";
import type { OAuthResult, Organization, SignalsInstall } from "./types";
import type { StoredOptions } from "../options";

import { request as requestPerms } from "./permissions";
import type { Resolver } from "./iglu";
import {
  SignalsClient,
  type AttributeGroup,
  type AttributeKey,
  type InterventionDefinition,
  type InterventionInstance,
} from "../components/Signals/SignalsClient";

export const useSignals = (
  login: OAuthResult | undefined,
  resolver: Resolver,
): [
  Record<string, SignalsInstall[]>,
  (
    | {
        client: SignalsClient;
        info: SignalsInstall;
        keys: AttributeKey[];
        groups: AttributeGroup[];
        interventions: InterventionDefinition[];
      }
    | undefined
  )[],
  Record<string, Set<string>>,
  Dispatch<StateUpdater<Record<string, Set<string>>>>,
  (InterventionInstance & { received: Date })[],
] => {
  const [signalsInstalls, setSignalsInstalls] = useState<
    Record<string, SignalsInstall[]>
  >({});
  const [signalsApiKeys, setSignalsApiKeys] = useState<
    Record<string, { apiKey: string; apiKeyId: string }>
  >({});
  const [attributeKeyIds, setAttributeKeyIds] = useState<
    Record<string, Set<string>>
  >({});
  const [interventions, setInterventions] = useState<
    (InterventionInstance & { received: Date })[]
  >([]);
  const [signalsDefs, setSignalsDefs] = useState<
    (
      | {
          client: SignalsClient;
          info: SignalsInstall;
          keys: AttributeKey[];
          groups: AttributeGroup[];
          interventions: InterventionDefinition[];
        }
      | undefined
    )[]
  >([]);
  const badSignals = useRef(new Set<SignalsClient>());

  useEffect(() => {
    const updateOptions = (_: any, namespace: string) =>
      namespace === "sync" &&
      chrome.storage.sync.get<StoredOptions>(
        {
          signalsApiKeys: [],
          signalsSandboxToken: "",
          signalsSandboxUrl: "",
        },
        ({ signalsApiKeys, signalsSandboxUrl, signalsSandboxToken }) => {
          setSignalsInstalls((signals) => {
            const updated = { ...signals };
            if (signalsSandboxUrl && signalsSandboxToken) {
              updated["sandbox"] = [
                {
                  orgId: "sandbox",
                  orgName: "sandbox",
                  endpoint: `Bearer:${signalsSandboxToken}@${signalsSandboxUrl.replace(/^.*:\/\//, "")}`,
                  label: "sandbox",
                  name: "sandbox",
                },
              ];
            } else {
              delete updated["sandbox"];
            }

            return updated;
          });

          setSignalsApiKeys(
            Object.fromEntries(
              signalsApiKeys.map(({ org, apiKey, apiKeyId }) => [
                org,
                {
                  apiKey,
                  apiKeyId,
                },
              ]),
            ),
          );
        },
      );

    chrome.storage.onChanged.addListener(updateOptions);
    updateOptions(null, "sync");

    return () => {
      chrome.storage.onChanged.removeListener(updateOptions);
    };
  }, []);

  useEffect(() => {
    if (!login) return;

    apiFetch("organizations", login.authentication).then(
      (organizations: Organization[]) => {
        consoleAnalytics(
          "Organization Discovery",
          undefined,
          undefined,
          organizations.length,
        );

        const ds = organizations.map((org) =>
          buildRegistry({
            kind: "ds",
            name: `${org.name} (Console)`,
            organizationId: org.id,
            useOAuth: true,
            dsApiEndpoint: CONSOLE_API,
          }),
        );

        Promise.all(
          organizations.map<
            Promise<
              {
                orgId: string;
                orgName: string;
                endpoint: string;
                name: string;
                label: string;
              }[]
            >
          >((org) =>
            apiFetch("signals/v1", login.authentication, org.id).then(
              (
                configured: {
                  config: { personalizationApiHost: string };
                  pipeline: { label: string; name: string };
                }[],
              ) =>
                configured.map((signals) => ({
                  orgId: org.id,
                  orgName: org.name,
                  endpoint: signals.config.personalizationApiHost,
                  name: signals.pipeline.name,
                  label: signals.pipeline.label,
                })),
              (err) => {
                console.error(err);
                return [];
              },
            ),
          ),
        ).then((entries) => {
          consoleAnalytics(
            "Signals Discovery",
            undefined,
            undefined,
            entries.reduce((acc, entry) => acc + entry.length, 0),
          );

          setSignalsInstalls((signals) =>
            Object.assign(
              {},
              signals,
              entries.reduce<typeof signals>((acc, instances) => {
                for (const instance of instances) {
                  if (instance.orgId in acc) {
                    acc[instance.orgId].push(instance);
                  } else {
                    acc[instance.orgId] = [instance];
                  }
                }

                return acc;
              }, {}),
            ),
          );
        });

        resolver.import(false, ...ds);
        return resolver.walk();
      },
      () => {
        consoleAnalytics("Organization Discovery Failure");
        // TODO: display error?
      },
    );
  }, [login, resolver, setSignalsInstalls]);

  const [apiClients, setApiClients] = useState<
    { info: SignalsInstall; client: SignalsClient }[]
  >([]);

  useEffect(() => {
    const clientParams: ([{ info: SignalsInstall }] &
      ConstructorParameters<typeof SignalsClient>)[] = [];
    const origins: string[] = [];
    for (const [org, endpoints] of Object.entries(signalsInstalls)) {
      if (org === "sandbox") {
        const endpoint = new URL(`https://${endpoints[0].endpoint}/`);
        origins.push(endpoint.origin + "/*");
        clientParams.push([
          {
            info: endpoints[0],
            baseUrl: endpoint.origin,
            sandboxToken: endpoint.password,
          },
        ]);
      } else {
        for (const info of endpoints) {
          const origin = `https://${info.endpoint}/`;
          origins.push(origin);

          // default to limited-functionality oauth credentials
          let apiKey = "",
            apiKeyId = "";
          // if we have defined an API key for this org, use it
          if (org in signalsApiKeys) {
            apiKey = signalsApiKeys[org].apiKey;
            apiKeyId = signalsApiKeys[org].apiKeyId;
            consoleAnalytics("Signals Auth", "Found", org);
          } else {
            consoleAnalytics("Signals Auth", "Missing", org);
          }

          clientParams.push([
            {
              info,
              baseUrl: origin,
              organizationId: org,
              apiKey,
              apiKeyId,
              login,
            },
          ]);
        }
      }
    }

    if (origins.length)
      requestPerms(...origins).then(
        () => {
          setApiClients(
            clientParams.map(([{ info, ...p }]) => ({
              info,
              client: new SignalsClient(p),
            })),
          );
        },
        () => consoleAnalytics("Signals Permissions", "Rejected"),
      );
  }, [signalsInstalls, signalsApiKeys]);

  useEffect(() => {
    setSignalsDefs([]);
    for (const [i, { client, info }] of apiClients.entries()) {
      const opts = client._getFetchOptions({ method: "GET" });
      if (client.sandboxToken) {
        Object.assign(opts.headers, {
          Authorization: `Bearer ${client.sandboxToken}`,
        });
      } else {
        // TODO: can we force the creds to update if apiKey is defined?
        Object.assign(opts.headers, login?.authentication.headers);
      }
      Promise.all([
        client
          .fetch(`${client.baseUrl}/api/v1/registry/attribute_keys/`, opts)
          .then(
            (resp): Promise<AttributeKey[]> => resp.json(),
            () => [],
          ),
        client
          .fetch(
            `${client.baseUrl}/api/v1/registry/attribute_groups/?applied=true`,
            opts,
          )
          .then(
            (resp): Promise<AttributeGroup[]> => resp.json(),
            () => [],
          ),
        client
          .fetch(`${client.baseUrl}/api/v1/registry/interventions/`, opts)
          .then(
            (resp): Promise<InterventionDefinition[]> => resp.json(),
            () => [],
          ),
      ]).then(([keys, groups, interventions]) => {
        setAttributeKeyIds((existing) => {
          const updated = { ...existing };
          let dirty = false;
          for (const attributeKey of keys) {
            const key = attributeKey.key || attributeKey.name;
            if (!(key in updated)) {
              updated[key] = new Set();
              dirty = true;
            }
          }

          return dirty ? updated : existing;
        });
        setSignalsDefs((existing) => {
          const updated = [...existing];
          updated[i] = {
            client,
            info,
            keys,
            groups,
            interventions,
          };
          return updated;
        });
      });
    }
  }, [apiClients]);

  useEffect(() => {
    const eventSources: EventSource[] = [];

    const subscriptions: Record<string, string>[] = [];
    const unsafeSubscriptions: Record<string, string>[] = [];

    for (const [key, ids] of Object.entries(attributeKeyIds)) {
      Array.from(ids, (v, i) => {
        if (/^[a-f0-9\-]{36}$/.test(v)) {
          subscriptions[i] = Object.assign(subscriptions[i] ?? {}, {
            [key]: v,
          });
        } else {
          const target = unsafeSubscriptions.findIndex((o) => !(key in o));
          if (target === -1) {
            unsafeSubscriptions.push({ [key]: v });
          } else {
            unsafeSubscriptions[target][key] = v;
          }
        }
      });
    }

    for (const { client } of apiClients) {
      // skip listening for clients we've had trouble with in the past
      // give them a small chance to recover though
      if (badSignals.current.has(client) && Math.random() < 0.3) continue;

      const endpoint = new URL(`${client.baseUrl}/api/v1/interventions`);

      for (const sub of subscriptions.concat(unsafeSubscriptions)) {
        const params = new URLSearchParams(sub);

        const es = new EventSource(`${endpoint}?${params.toString()}`);

        es.addEventListener("error", () => {
          badSignals.current.add(client);
          es.close();
        });

        es.addEventListener("message", (ev: MessageEvent<string>) => {
          badSignals.current.delete(client);
          setInterventions((existing) => [
            ...existing,
            Object.assign(JSON.parse(ev.data), { received: new Date() }),
          ]);
        });

        es.addEventListener("open", () => {
          badSignals.current.delete(client);
          eventSources.push(es);
        });
      }
    }

    return () => {
      for (const source of eventSources) {
        source.close();
      }
    };
  }, [apiClients, attributeKeyIds]);

  return [
    signalsInstalls,
    signalsDefs,
    attributeKeyIds,
    setAttributeKeyIds,
    interventions,
  ];
};
