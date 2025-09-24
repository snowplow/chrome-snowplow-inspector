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

import logo from "@res/logo.svg";

const AttributeGroupData: FunctionComponent<{
  client: SignalsClient;
  group: AttributeGroup;
  identifiers: Record<string, Set<string>>;
}> = ({
  client,
  group: { name, version, attributes, attribute_key },
  identifiers,
}) => {
  const [values, setValues] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const ids = [...(identifiers[attribute_key.name] ?? [])];
    let cancelled = false;

    ids.map((identifier, i) => {
      client
        .getGroupAttributes({
          name,
          version,
          attributes: attributes.map((attr) => attr.name) as any,
          attribute_key: attribute_key.name,
          identifier,
        })
        .then((attributes) => {
          if (!cancelled)
            setValues((current) => {
              const updated = [...current];
              updated[i] = {
                attributeKey: attribute_key.name,
                identifier,
                ...attributes,
              };
              return updated;
            });
        });

      return () => {
        cancelled = true;
      };
    });
  }, [identifiers]);

  return (
    <details key={`${name}_${version}`}>
      <summary>
        {name} (v{version})
      </summary>
      {values.map(
        (attributes) =>
          attributes && (
            <textarea readOnly value={JSON.stringify(attributes, null, 2)} />
          ),
      )}
    </details>
  );
};

const SignalsData: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  groups: AttributeGroup[];
  client: SignalsClient;
}> = ({ attributeKeyIds, client, groups }) => (
  <details>
    <summary>{client.baseUrl}</summary>
    {groups.map((g) => (
      <AttributeGroupData
        client={client}
        group={g}
        identifiers={attributeKeyIds}
      />
    ))}
  </details>
);

const AttributesUI: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: {
    client: SignalsClient;
    keys: AttributeKey[];
    groups: AttributeGroup[];
  }[];
}> = ({ attributeKeyIds, signalsDefs }) => {
  return [
    <aside>
      <img alt="Snowplow logo" src={logo} />
      <h1>Signals Behavioral Attributes</h1>
      <p>
        Behavioral attributes are indicators derived from your online
        activities, reflecting how you interact with content and services. These
        signals can be tailored to meet your specific business needs, allowing
        for a personalized approach to user engagement.
      </p>
      <a target="_blank" href="https://docs.snowplow.io/docs/signals">
        Learn more
      </a>
    </aside>,
    <article>
      {signalsDefs.map(
        (data, i) =>
          data && <SignalsData attributeKeyIds={attributeKeyIds} {...data} />,
      )}
    </article>,
  ];
};

export const Attributes: FunctionComponent<{
  login?: OAuthResult;
  setAttributeCount: Dispatch<StateUpdater<number | undefined>>;
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: {
    client: SignalsClient;
    keys: AttributeKey[];
    groups: AttributeGroup[];
  }[];
  signalsInfo: Record<string, string[]>;
}> = ({ attributeKeyIds, login, signalsDefs, signalsInfo }) => {
  const signalsAvailable = Object.keys(signalsInfo).length > 0;
  return (
    <main key="app" class="app app--attributes attributes">
      {signalsAvailable ? (
        <AttributesUI
          attributeKeyIds={attributeKeyIds}
          signalsDefs={signalsDefs}
        />
      ) : (
        <Brochure login={login} />
      )}
    </main>
  );
};
