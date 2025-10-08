import { h, type FunctionComponent } from "preact";
import {
  useErrorBoundary,
  useState,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";

import { errorAnalytics } from "../../ts/analytics";
import type { OAuthResult, SignalsInstall } from "../../ts/types";

import { JsonViewer } from "../JSONViewer";

import { Brochure } from "./Brochure";
import type {
  InterventionDefinition,
  ReceivedIntervention,
} from "./SignalsClient";

import logo from "@res/logo.svg";

const dt = Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const InterventionDefinitionDisplay: FunctionComponent<{
  definition?: InterventionDefinition;
}> = ({ definition }) => {
  if (!definition) return null;

  return (
    <details open={false}>
      <summary>Intervention definition</summary>

      <JsonViewer data={definition} />
    </details>
  );
};

const InterventionsUI: FunctionComponent<{
  interventions: ReceivedIntervention[];
  definitions: InterventionDefinition[];
}> = ({ definitions, interventions }) => {
  const [active, setActive] = useState<ReceivedIntervention>();
  return [
    <aside>
      <hgroup>
        <img alt="Snowplow logo" src={logo} />
        <h1>Interventions Signals</h1>
        <p>
          Utilize Behavioral attributes and AI to dynamically guide users based
          on their actions.
        </p>
      </hgroup>
      {interventions.length ? (
        <figure>
          <figcaption>Intervention Order</figcaption>
          <ul>
            {interventions.map((intervention, i) => (
              <li
                key={i}
                class={intervention === active ? "active" : ""}
                onClick={() => setActive(intervention)}
                role="button"
                tabindex={0}
              >
                <span data-received={dt.format(intervention.received)}>
                  {intervention.name}
                </span>
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
      <p>
        By analyzing online behaviors, we can tailor interactions to enhance
        user experience and engagement, ensuring that each user receives a
        personalized journey.
      </p>
      <a target="_blank" href="https://docs.snowplow.io/docs/signals">
        Learn more
      </a>
    </aside>,
    <article>
      {active && (
        <div>
          <h1>{active.name}</h1>
          <h2>Intervention details</h2>
          <table>
            <tr>
              <th>Intervention ID</th>
              <td>
                <span>{active.intervention_id}</span>
              </td>
            </tr>
            <tr>
              <th>Intervention name</th>
              <td>
                <span>{active.name}</span>
              </td>
            </tr>
            <tr>
              <th>Version</th>
              <td>
                <span>v{active.version}</span>
              </td>
            </tr>
            <tr>
              <th>Target attribute key</th>
              <td>
                <span>{active.target_attribute_key.name}</span>
              </td>
            </tr>
            <tr>
              <th>Attribute key value</th>
              <td>
                <span>{active.target_attribute_key.id}</span>
              </td>
            </tr>
          </table>
          <h2>Associated attributes</h2>
          <table>
            {Object.entries(active.attributes ?? {}).map(
              ([attribute, value]) => (
                <tr key={attribute}>
                  <th>{attribute}</th>
                  <td>
                    <span>{value}</span>
                  </td>
                </tr>
              ),
            )}
          </table>

          <InterventionDefinitionDisplay
            definition={definitions.find(
              ({ name, version }) =>
                name === active.name && version === active.version,
            )}
          />
        </div>
      )}
    </article>,
  ];
};

export const Interventions: FunctionComponent<{
  login?: OAuthResult;
  interventions: ReceivedIntervention[];
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
  setInterventionCount: Dispatch<StateUpdater<number | undefined>>;
  signalsDefs: ({ interventions: InterventionDefinition[] } | undefined)[];
  signalsInfo: Record<string, SignalsInstall[]>;
}> = ({ interventions, login, setLogin, signalsDefs, signalsInfo }) => {
  useErrorBoundary(errorAnalytics);
  const signalsAvailable = Object.keys(signalsInfo).length > 0;
  return (
    <main key="app" class="app app--interventions interventions">
      {signalsAvailable ? (
        <InterventionsUI
          interventions={interventions}
          definitions={signalsDefs.flatMap(
            ({ interventions } = { interventions: [] }) => interventions,
          )}
        />
      ) : (
        <Brochure login={login} setLogin={setLogin} />
      )}
    </main>
  );
};
