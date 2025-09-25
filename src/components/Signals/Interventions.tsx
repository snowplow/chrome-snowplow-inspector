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
              <span>{intervention.name}</span>
              <span>{dt.format(intervention.received)}</span>
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
      {interventions.map((data) => (
        <textarea readOnly value={JSON.stringify(data, null, 2)} />
      ))}
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
