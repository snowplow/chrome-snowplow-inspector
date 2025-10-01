import {
  useEffect,
  useState,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";

import { consoleAnalytics } from "./analytics";
import { buildRegistry } from "./iglu";
import { apiFetch, CONSOLE_API } from "./oauth";
import type { OAuthResult, Organization } from "./types";
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
  Record<string, string[]>,
  (
    | {
        client: SignalsClient;
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
    Record<string, string[]>
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
          keys: AttributeKey[];
          groups: AttributeGroup[];
          interventions: InterventionDefinition[];
        }
      | undefined
    )[]
  >([]);

  useEffect(() => {
    const updateOptions = (
      _: any,
      namespace: string,
    ) =>
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
                `Bearer:${signalsSandboxToken}@${signalsSandboxUrl}`,
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
          organizations.map<Promise<[string, string][]>>((org) =>
            apiFetch("signals/v1", login.authentication, org.id).then(
              (configured: { config: { personalizationApiHost: string } }[]) =>
                configured.map((signals) => [
                  org.id,
                  signals.config.personalizationApiHost,
                ]),
              (err) => {
                console.error(err);
                return [];
              },
            ),
          ),
        ).then((entries) =>
          setSignalsInstalls((signals) =>
            Object.assign(
              {},
              signals,
              entries.reduce<Record<string, string[]>>((acc, pairs) => {
                for (const [org, endpoints] of pairs) {
                  if (org in acc) {
                    acc[org].push(endpoints);
                  } else {
                    acc[org] = [endpoints];
                  }
                }

                return acc;
              }, {}),
            ),
          ),
        );

        resolver.import(false, ...ds);
        return resolver.walk();
      },
      () => {
        consoleAnalytics("Organization Discovery Failure");
        // TODO: display error?
      },
    );
  }, [login, resolver, setSignalsInstalls]);

  const [apiClients, setApiClients] = useState<SignalsClient[]>([]);

  useEffect(() => {
    const clientParams: ConstructorParameters<typeof SignalsClient>[] = [];
    const origins: string[] = [];
    for (const [org, endpoints] of Object.entries(signalsInstalls)) {
      if (org === "sandbox") {
        const endpoint = new URL(`https://${endpoints[0]!}/`);
        origins.push(endpoint.origin + "/*");
        clientParams.push([
          {
            baseUrl: endpoint.origin,
            sandboxToken: endpoint.password,
          },
        ]);
      } else {
        for (const endpoint of endpoints) {
          const origin = `https://${endpoint}/`;
          origins.push(origin);

          // default to limited-functionality oauth credentials
          let apiKey = "",
            apiKeyId = "";
          // if we have defined an API key for this org, use it
          if (org in signalsApiKeys) {
            apiKey = signalsApiKeys[org].apiKey;
            apiKeyId = signalsApiKeys[org].apiKeyId;
          }

          clientParams.push([
            {
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
      requestPerms(...origins).then(() => {
        setApiClients(clientParams.map((p) => new SignalsClient(...p)));
      });
  }, [signalsInstalls, signalsApiKeys]);

  useEffect(() => {
    setSignalsDefs([]);
    for (const client of apiClients) {
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
          updated[apiClients.indexOf(client)] = {
            client,
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

    for (const [key, ids] of Object.entries(attributeKeyIds)) {
      Array.from(ids, (v, i) => {
        subscriptions[i] = Object.assign(subscriptions[i] ?? {}, { [key]: v });
      });
    }

    for (const client of apiClients) {
      const endpoint = new URL(`${client.baseUrl}/api/v1/interventions`);

      for (const sub of subscriptions) {
        const params = new URLSearchParams(sub);
        const es = new EventSource(`${endpoint}?${params.toString()}`);
        es.addEventListener("message", (ev: MessageEvent<string>) => {
          setInterventions((existing) => [
            ...existing,
            Object.assign(JSON.parse(ev.data), { received: new Date() }),
          ]);
        });
        eventSources.push(es);
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
