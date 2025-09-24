import { h, type FunctionComponent } from "preact";
import type { OAuthResult } from "../../ts/types";
import type { Dispatch, StateUpdater } from "preact/hooks";

import { Brochure } from "./Brochure";

import logo from "@res/logo.svg";
import type { InterventionInstance } from "./SignalsClient";

const InterventionsUI: FunctionComponent<{
  interventions: InterventionInstance[];
}> = ({ interventions }) => {
  return [
    <aside>
      <img alt="Snowplow logo" src={logo} />
      <h1>Signals Interventions</h1>
      <p>lorem ipsum</p>
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
  interventions: InterventionInstance[];
  setInterventionCount: Dispatch<StateUpdater<number | undefined>>;
  signalsInfo: Record<string, string[]>;
}> = ({ interventions, login, signalsInfo }) => {
  const signalsAvailable = Object.keys(signalsInfo).length > 0;
  return (
    <main key="app" class="app app--interventions interventions">
      {signalsAvailable ? (
        <InterventionsUI interventions={interventions} />
      ) : (
        <Brochure login={login} />
      )}
    </main>
  );
};
