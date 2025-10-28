import { h, type FunctionComponent } from "preact";
import {
  useEffect,
  useErrorBoundary,
  useMemo,
  useState,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";

import { errorAnalytics } from "../../ts/analytics";
import type { OAuthResult, SignalsInstall } from "../../ts/types";

import { Brochure } from "./Brochure";
import {
  SignalsClient,
  type AttributeGroup,
  type AttributeKey,
} from "./SignalsClient";

import { JsonViewer } from "../JSONViewer";

import { RefreshCw, Search, X } from "lucide-preact";

type ResourceDefinitions =
  | {
      client: SignalsClient | null;
      info: SignalsInstall;
      keys: AttributeKey[];
      groups: AttributeGroup[];
    }
  | undefined;

type SourceFilter = "All" | "Stream" | "Batch" | "External";

const cache = new Map<
  string,
  (
    | {
        attributeKey: string;
        identifier: string;
        [attribute: string]: unknown;
      }
    | undefined
  )[]
>();

const AttributeGroupData: FunctionComponent<{
  client: SignalsClient;
  eventCount?: number;
  filter?: string | RegExp;
  sourceFilter: SourceFilter;
  groups: AttributeGroup[];
  identifiers: Record<string, Set<string>>;
  includeInstance: boolean;
  orgName: string;
  label: string;
  refresh: number;
}> = ({
  client,
  eventCount,
  filter,
  sourceFilter,
  groups,
  identifiers,
  includeInstance,
  orgName,
  label,
  refresh,
}) => {
  useErrorBoundary(errorAnalytics);
  const [version, setVersion] = useState(
    Math.max(...groups.map(({ version }) => version)),
  );

  const { name, attributes, attribute_key, offline, fields } =
    groups[groups.findIndex((ag) => ag.version === version)];

  const cacheKey = [client.baseUrl, name, version, attribute_key.name].join(
    ".",
  );

  const source: SourceFilter = !offline
    ? "Stream"
    : fields && fields.length
      ? "External"
      : "Batch";
  if (sourceFilter !== source && sourceFilter !== "All") return null;

  const [values, setValues] = useState<
    (
      | {
          attributeKey: string;
          identifier: string;
          [attribute: string]: unknown;
        }
      | undefined
    )[]
  >(cache.get(cacheKey) ?? []);

  useEffect(() => {
    if (values.length) {
      cache.set(cacheKey, values);
    }
  }, [cacheKey, values]);

  useEffect(() => {
    if (refresh) {
      setValues([]);
    }
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const ids = [...(identifiers[attribute_key.name] ?? [])];

    const attributeNames = ([] as { name: string }[])
      .concat(...attributes, ...(fields ?? []))
      .map(({ name }) => name);

    const fetchForIdentifier = (identifier: string, i: number) => {
      if (!attributeNames.length) return;
      client
        .getGroupAttributes({
          name,
          version,
          attributes: attributeNames as [string, ...string[]],
          attribute_key: attribute_key.name,
          identifier,
        })
        .then(
          (attributeValues) => {
            if (
              !cancelled &&
              Object.entries(attributeValues).some(
                ([prop, val]) => val != null && prop != attribute_key.name,
              )
            )
              setValues((current) => {
                const updated = [...current];
                updated[i] = {
                  attributeKey: attribute_key.name,
                  identifier,
                  ...attributeValues,
                };
                return updated;
              });
          },
          (err) => {
            setValues((current) => {
              const updated = [...current];
              updated[i] = {
                attributeKey: attribute_key.name,
                identifier,
                error: String(err),
              };
              return updated;
            });
          },
        );
    };

    const fetchAllIdentifiers = () => {
      ids.forEach(fetchForIdentifier);
    };

    let timeout: ReturnType<typeof setTimeout>;

    if (client.sandboxToken) {
      timeout = setTimeout(function tick() {
        fetchAllIdentifiers();
        timeout = setTimeout(tick, 500);
      }, 500);
    } else {
      timeout = setTimeout(fetchAllIdentifiers, 5000);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [identifiers, version, eventCount, refresh]);

  if (!values.some(Boolean)) return null;

  if (typeof filter === "string") filter = filter.toLowerCase();

  const [definitionSelection, setDefinitionSelection] = useState<string>();
  const showDef =
    definitionSelection &&
    attributes.find((att) => att.name === definitionSelection);

  return (
    <details open>
      <summary key="summary">
        <span class="groupname">{name}</span>
        {includeInstance && <span class="groupinstance">{orgName}</span>}
        <span class="grouplabel">{label}</span>
        {groups.length > 1 ? (
          <select
            class="groupversion"
            disabled={groups.length < 2}
            onChange={({ currentTarget }) =>
              setVersion(parseInt(currentTarget.value, 10))
            }
          >
            {groups.map((ag) => (
              <option value={ag.version} selected={ag.version === version}>
                v{ag.version}
              </option>
            ))}
          </select>
        ) : (
          <span class="groupversion">v{version}</span>
        )}
        <span class="groupsource">{source}</span>
      </summary>
      {showDef ? (
        <figure class="attrdef" key="definition">
          <figcaption onClick={() => setDefinitionSelection(undefined)}>
            Attribute Definition: {showDef.name} <X />
          </figcaption>
          <JsonViewer data={showDef} />
        </figure>
      ) : null}
      {values.map((result) => {
        if (!result) return;
        const { attributeKey, identifier, ...attributes } = result;
        const filtered = Object.entries(attributes).filter(
          ([attribute, value]) => {
            if (!filter) return true;

            if (typeof filter === "string") {
              return (
                name.toLowerCase().includes(filter) ||
                attributeKey.toLowerCase().includes(filter) ||
                identifier.toLowerCase().includes(filter) ||
                attribute.toLowerCase().includes(filter) ||
                String(value).toLowerCase().includes(filter)
              );
            } else {
              return (
                filter.test(name) ||
                filter.test(attributeKey) ||
                filter.test(identifier) ||
                filter.test(attribute) ||
                filter.test(String(value))
              );
            }
          },
        );

        if (!filtered.length) return null;

        return (
          <table key={identifier}>
            <tbody>
              {filtered.map(([attribute, value]) => (
                <tr
                  key={attribute}
                  onClick={() =>
                    setDefinitionSelection((current) =>
                      current === attribute ? undefined : attribute,
                    )
                  }
                >
                  <th>{attribute}</th>
                  <td>
                    {attribute !== "error" ||
                    !/\[Signals\] 401|required for BDP authentication/.test(
                      String(value),
                    ) ? (
                      <span>{JSON.stringify(value, null, 2)}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => chrome.runtime.openOptionsPage()}
                      >
                        Click here to set an API key to access attribute values
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </details>
  );
};

const MultiInstanceData: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  definitions: ResourceDefinitions[];
  eventCount?: number;
  filter?: string | RegExp;
  labelFilter: Record<string, boolean>;
  orgFilter: string;
  sourceFilter: SourceFilter;
  refresh: number;
}> = ({
  attributeKeyIds,
  definitions,
  eventCount,
  filter,
  labelFilter,
  orgFilter,
  sourceFilter,
  refresh,
}) =>
  definitions.map((resources) => {
    if (!resources) return null;
    const {
      client,
      groups,
      info: { orgName, label },
    } = resources;
    if (!client) return null;
    if (orgFilter !== "All" && orgFilter !== orgName) return null;
    if (label in labelFilter && !labelFilter[label]) return null;

    const versionGroups = useMemo(
      () =>
        groups.reduce(
          (acc, group) => {
            const key = client.baseUrl + group.name;
            if (!(key in acc)) acc[key] = [];
            acc[key].push(group);
            return acc;
          },
          {} as Record<string, AttributeGroup[]>,
        ),
      [client, groups],
    );

    return Object.values(versionGroups).map((versions) => (
      <AttributeGroupData
        key={`${client.baseUrl}.${versions[0].name}`}
        eventCount={eventCount}
        client={client}
        filter={filter}
        sourceFilter={sourceFilter}
        groups={versions}
        identifiers={attributeKeyIds}
        orgName={orgName}
        label={label}
        includeInstance={definitions.length > 1}
        refresh={refresh}
      />
    ));
  });

const AttributesUI: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  eventCount?: number;
  signalsDefs: ResourceDefinitions[];
  signalsInfo: Record<string, SignalsInstall[]>;
}> = ({ attributeKeyIds, eventCount, signalsDefs, signalsInfo }) => {
  const stateKey = "signals-attribute-filters";
  const storedFilters = sessionStorage.getItem(stateKey);

  const stored: {
    filter: string;
    labelFilter: Record<string, boolean>;
    orgFilter: string;
    sourceFilter: SourceFilter;
  } = storedFilters
    ? JSON.parse(storedFilters)
    : {
        filter: "",
        labelFilter: {},
        orgFilter: "All",
        sourceFilter: "All",
      };

  const [filter, setFilter] = useState(stored.filter);
  const [labelFilter, setLabelFilter] = useState(stored.labelFilter);
  const [orgFilter, setOrgFilter] = useState(stored.orgFilter);
  const [sourceFilter, setSourceFilter] = useState(stored.sourceFilter);

  const [refresh, setRefresh] = useState(0);

  useEffect(
    () =>
      sessionStorage.setItem(
        stateKey,
        JSON.stringify({ filter, sourceFilter, labelFilter, orgFilter }),
      ),
    [filter, sourceFilter, labelFilter, orgFilter],
  );

  let pattern: string | RegExp = filter;
  try {
    pattern = pattern && new RegExp(pattern, "i");
  } catch (_) {}

  const orgs = new Set<string>();
  const labels = new Set<string>();

  for (const installs of Object.values(signalsInfo)) {
    for (const install of installs) {
      orgs.add(install.orgName);
      labels.add(install.label);
    }
  }

  return (
    <article>
      <div class="attribute-group-controls">
        <label key="search" title="Search Behaviors Attributes">
          <span>
            <Search />
          </span>
          <input
            type="text"
            placeholder="Search Behaviors Attributes"
            onKeyUp={(e) => {
              if (e.currentTarget instanceof HTMLInputElement) {
                setFilter(e.currentTarget.value);
              }
            }}
            value={filter}
          />
        </label>
        <label key="refresh" title="Refresh attributes">
          <button
            type="button"
            onClick={() => {
              cache.clear();
              setRefresh((r) => r + 1);
            }}
          >
            <RefreshCw />
          </button>
        </label>
        {Array.from(labels.values(), (l) => (
          <label key={`lbl-${l}`} class="lbl">
            <input
              type="checkbox"
              checked={labelFilter[l] ?? true}
              onChange={({ currentTarget }) =>
                setLabelFilter((current) => ({
                  ...current,
                  [l]: currentTarget.checked,
                }))
              }
            />
            {l}
          </label>
        ))}
        {orgs.size > 1 ? (
          <label key="orgs" title="Filter organizations">
            <select
              onChange={({ currentTarget }) =>
                setOrgFilter(currentTarget.value ?? "All")
              }
            >
              <option key="all" value="All" selected={orgFilter == "All"}>
                All organizations
              </option>
              {Array.from(orgs, (org) => (
                <option key={org} value={org} selected={orgFilter == org}>
                  {org}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label key="sources" title="Filter sources">
          <select
            onChange={({ currentTarget }) =>
              setSourceFilter(currentTarget.value as SourceFilter)
            }
          >
            <option value="All" selected={sourceFilter == "All"}>
              All sources
            </option>
            <option value="Stream" selected={sourceFilter == "Stream"}>
              Stream sources
            </option>
            <option value="Batch" selected={sourceFilter == "Batch"}>
              Batch sources
            </option>
            <option value="External" selected={sourceFilter == "External"}>
              External batch sources
            </option>
          </select>
        </label>
      </div>
      {Object.values(attributeKeyIds).some((s) => s.size > 0) ? (
        <MultiInstanceData
          attributeKeyIds={attributeKeyIds}
          definitions={signalsDefs}
          eventCount={eventCount}
          filter={pattern}
          labelFilter={labelFilter}
          orgFilter={orgFilter}
          sourceFilter={sourceFilter}
          refresh={refresh}
        />
      ) : orgs.size > (orgs.has("sandbox") ? 1 : 0) ? (
        <p>
          No attribute keys found. Inspect more Events to populate attribute key
          values.
        </p>
      ) : (
        <p>Detecting Signals configuration, hold tight!</p>
      )}
    </article>
  );
};

export const Attributes: FunctionComponent<{
  login?: OAuthResult;
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: ResourceDefinitions[];
  signalsInfo: Record<string, SignalsInstall[]>;
  eventCount?: number;
}> = ({
  attributeKeyIds,
  eventCount,
  login,
  setLogin,
  signalsDefs,
  signalsInfo,
}) => {
  const signalsAvailable = Object.keys(signalsInfo).length > 0;
  return (
    <main key="app" class="app app--attributes attributes">
      {signalsAvailable ? (
        <AttributesUI
          attributeKeyIds={attributeKeyIds}
          eventCount={eventCount}
          signalsDefs={signalsDefs}
          signalsInfo={signalsInfo}
        />
      ) : (
        <Brochure login={login} setLogin={setLogin} />
      )}
    </main>
  );
};
