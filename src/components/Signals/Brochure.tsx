import { h, type FunctionComponent } from "preact";
import type { Dispatch, StateUpdater } from "preact/hooks";
import type { OAuthResult } from "../../ts/types";

import { consoleAnalytics } from "../../ts/analytics";
import { doOAuthFlow } from "../../ts/oauth";

import logo from "@res/logo.svg";

export const Brochure: FunctionComponent<{
  login?: OAuthResult;
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
}> = ({ login, setLogin }) => {
  const loginHandler = (e: Event) => {
    e.preventDefault();
    consoleAnalytics("Auth Flow Start");
    doOAuthFlow(true).then(
      (response) => {
        consoleAnalytics("Auth Flow Complete");
        setLogin(response);
      },
      (e: Error) => {
        consoleAnalytics("Auth Flow Error", String(e));
        // TODO: display error information
      },
    );
  };

  return (
    <article class="brochure">
      <div>
        <img alt="Snowplow logo" src={logo} />
        <h1>Signals</h1>
        <p>
          a personalization engine built on Snowplow's behavioral data pipeline.
          Allows users to enhance their applications by aggregating user
          attributes and providing near real-time visibility into customer
          behavior.
        </p>
        <p>
          With seamless access to user history, it simplifies creating
          personalized, intelligent experiences.
        </p>
      </div>
      <div>
        {login ? (
          <a
            href="https://snowplow.io/get-started/book-a-demo-of-snowplow-bdp"
            target="_blank"
          >
            Get a Demo
          </a>
        ) : (
          <a onClick={loginHandler}>Log in to enable Signals</a>
        )}
        <a href="https://docs.snowplow.io/tutorials/" target="_blank">
          View a tutorial
        </a>
      </div>
    </article>
  );
};
