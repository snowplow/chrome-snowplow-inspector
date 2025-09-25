import { h, type FunctionComponent } from "preact";
import type { OAuthResult } from "../../ts/types";
import { useState, type Dispatch, type StateUpdater } from "preact/hooks";

import { Brochure } from "./Brochure";

import logo from "@res/logo.svg";
import type { ReceivedIntervention } from "./SignalsClient";

const dt = Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
  hour12: false,
});

const InterventionsUI: FunctionComponent<{
  interventions: ReceivedIntervention[];
}> = ({ interventions }) => {
  const [active, setActive] = useState<ReceivedIntervention>();
  return [
    <aside>
      <img alt="Snowplow logo" src={logo} />
      <h1>Signals Interventions</h1>
      <p>
        Utilize Behavioral attributes and AI to dynamically guide users based on
        their actions.
      </p>
      {interventions.length ? (
        <ul>
          {interventions.map((intervention, i) => (
            <li>
              <button type="button" onClick={() => setActive(intervention)}>
                <span>{intervention.name}</span>
                <span>{dt.format(intervention.received)}</span>
              </button>
            </li>
          ))}
        </ul>
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
              <td>{active.intervention_id}</td>
            </tr>
            <tr>
              <th>Intervention name</th>
              <td>{active.name}</td>
            </tr>
            <tr>
              <th>Version</th>
              <td>v{active.version}</td>
            </tr>
            <tr>
              <th>Target attribute key</th>
              <td>{active.target_attribute_key.name}</td>
            </tr>
            <tr>
              <th>Target attribute key identifier</th>
              <td>{active.target_attribute_key.id}</td>
            </tr>
          </table>
          <h2>Associated attributes</h2>
          <table>
            {Object.entries(active.attributes).map(([attribute, value]) => (
              <tr key={attribute}>
                <th>{attribute}</th>
                <td>{value}</td>
              </tr>
            ))}
          </table>
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
  signalsInfo: Record<string, string[]>;
}> = ({ interventions, login, setLogin, signalsInfo }) => {
  const signalsAvailable = Object.keys(signalsInfo).length > 0;
  return (
    <main key="app" class="app app--interventions interventions">
      {signalsAvailable ? (
        <InterventionsUI interventions={interventions} />
      ) : (
        <Brochure login={login} setLogin={setLogin} />
      )}
    </main>
  );
};
