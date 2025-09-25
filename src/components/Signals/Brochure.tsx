import { h, type FunctionComponent } from "preact";
import type { OAuthResult } from "../../ts/types";

import logo from "@res/logo.svg";

export const Brochure: FunctionComponent<{ login?: OAuthResult }> = ({
  login,
}) => {
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
          <a href="" target="_blank">
            Log in to enable Signals
          </a>
        )}
        <a href="" target="_blank">
          View a tutorial
        </a>
      </div>
    </article>
  );
};
