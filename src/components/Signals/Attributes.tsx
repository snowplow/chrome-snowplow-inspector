import { h, type FunctionComponent } from "preact";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";

import type { OAuthResult } from "../../ts/types";

import { Brochure } from "./Brochure";
import {
  SignalsClient,
  type AttributeGroup,
  type AttributeKey,
} from "./SignalsClient";

import { JsonViewer } from "../JSONViewer";

import { Search } from "lucide-preact";

type ResourceDefinitions =
  | {
      client: SignalsClient | null;
      keys: AttributeKey[];
      groups: AttributeGroup[];
    }
  | undefined;

type SourceFilter = "All" | "Stream" | "Batch" | "External";

const AttributeGroupData: FunctionComponent<{
  client: SignalsClient;
  filter?: string | RegExp;
  sourceFilter: SourceFilter;
  groups: AttributeGroup[];
  identifiers: Record<string, Set<string>>;
  includeInstance: boolean;
}> = ({
  client,
  filter,
  sourceFilter,
  groups,
  identifiers,
  includeInstance,
}) => {
  const [version, setVersion] = useState(
    Math.max(...groups.map(({ version }) => version)),
  );

  const { name, attributes, attribute_key, offline, fields } =
    groups[groups.findIndex((ag) => ag.version === version)];

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
  >([]);

  useEffect(() => {
    let cancelled = false;
    const ids = [...(identifiers[attribute_key.name] ?? [])];

    ids.forEach((identifier, i) => {
      client
        .getGroupAttributes({
          name,
          version,
          attributes: attributes.map((attr) => attr.name) as any,
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

      return () => {
        cancelled = true;
      };
    });
  }, [identifiers, version]);

  if (!values.some(Boolean)) return null;

  if (typeof filter === "string") filter = filter.toLowerCase();

  const [definitionSelection, setDefinitionSelection] = useState<string>();
  const showDef =
    definitionSelection &&
    attributes.find((att) => att.name === definitionSelection);

  return (
    <details open>
      <summary>
        <span class="groupname">{name}</span>
        {includeInstance && <span class="groupinstance">{client.baseUrl}</span>}
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
      {showDef ? <JsonViewer data={showDef} /> : null}
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
          </table>
        );
      })}
    </details>
  );
};

const MultiInstanceData: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  definitions: ResourceDefinitions[];
  filter?: string | RegExp;
  sourceFilter: SourceFilter;
}> = ({ attributeKeyIds, definitions, filter, sourceFilter }) =>
  definitions.map(
    ({ client, groups } = { client: null, groups: [], keys: [] }) => {
      if (!client) return null;

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
          client={client}
          filter={filter}
          sourceFilter={sourceFilter}
          groups={versions}
          identifiers={attributeKeyIds}
          includeInstance={definitions.length > 1}
        />
      ));
    },
  );

const AttributesUI: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: ResourceDefinitions[];
}> = ({ attributeKeyIds, signalsDefs }) => {
  const [filter, setFilter] = useState<string>();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All");

  let pattern: undefined | string | RegExp = filter;
  try {
    pattern = pattern && new RegExp(pattern, "i");
  } catch (_) {}

  return (
    <article>
      <div class="attribute-group-controls">
        <label title="Search Behaviors Attributes">
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
        <label title="Filter sources">
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
          filter={pattern}
          sourceFilter={sourceFilter}
        />
      ) : (
        <p>
          No attribute keys found. Inspect more Events to populate attribute key
          values.
        </p>
      )}
    </article>
  );
};

export const Attributes: FunctionComponent<{
  login?: OAuthResult;
  setAttributeCount: Dispatch<StateUpdater<number | undefined>>;
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: ResourceDefinitions[];
  signalsInfo: Record<string, string[]>;
}> = ({ attributeKeyIds, login, setLogin, signalsDefs, signalsInfo }) => {
  const signalsAvailable = Object.keys(signalsInfo).length > 0;
  return (
    <main key="app" class="app app--attributes attributes">
      {signalsAvailable ? (
        <AttributesUI
          attributeKeyIds={attributeKeyIds}
          signalsDefs={signalsDefs}
        />
      ) : (
        <Brochure login={login} setLogin={setLogin} />
      )}
    </main>
  );
};
