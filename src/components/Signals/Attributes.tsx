import { h, type FunctionComponent } from "preact";
import {
  useEffect,
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

const AttributeGroupData: FunctionComponent<{
  client: SignalsClient;
  filter?: string | RegExp;
  group: AttributeGroup;
  identifiers: Record<string, Set<string>>;
}> = ({
  client,
  filter,
  group: { name, version, attributes, attribute_key, batch_source },
  identifiers,
}) => {
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

    ids.map((identifier, i) => {
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
            if (!cancelled)
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
  }, [identifiers]);

  if (typeof filter === "string") filter = filter.toLowerCase();

  const [definitionSelection, setDefinitionSelection] = useState<string>();
  const showDef =
    definitionSelection &&
    attributes.find((att) => att.name === definitionSelection);

  return (
    <details open>
      <summary>
        <span class="groupname">{name}</span>
        <span class="groupinstance">{client.baseUrl}</span>
        <span class="groupversion">{`v${version}`}</span>
        <span class="groupsource">
          {batch_source == null ? "Stream" : "Batch"}
        </span>
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
                  !/\[Signals\] 401/.test(String(value)) ? (
                    <span>{String(value)}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => chrome.runtime.openOptionsPage()}
                    >
                      API key required to access attribute values
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
}> = ({ attributeKeyIds, definitions, filter }) =>
  definitions.map(
    ({ client, groups } = { client: null, groups: [], keys: [] }) =>
      client &&
      groups.map((g) => (
        <AttributeGroupData
          key={`${client.baseUrl}.${g.name}.${g.version}`}
          client={client}
          filter={filter}
          group={g}
          identifiers={attributeKeyIds}
        />
      )),
  );

const AttributesUI: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: ResourceDefinitions[];
}> = ({ attributeKeyIds, signalsDefs }) => {
  const [filter, setFilter] = useState<string>();

  let pattern: undefined | string | RegExp = filter;
  try {
    pattern = pattern && new RegExp(pattern, "i");
  } catch (_) {}

  return (
    <article>
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
      <MultiInstanceData
        attributeKeyIds={attributeKeyIds}
        definitions={signalsDefs}
        filter={pattern}
      />
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
