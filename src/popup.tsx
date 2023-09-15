import { render, h, Fragment } from "preact";

import "./popup.scss";

const REPOSITORY_URL =
  "https://github.com/poplindata/chrome-snowplow-inspector";

const Popup = () => (
  <>
    <div class="banner">
      <a
        href="https://snowplow.io/?utm_source=debugger%20extension&utm_medium=software&utm_campaign=Chrome%20extension%20about%20page%20logo"
        target="_blank"
      >
        <img src="logo.svg" alt="Snowplow logo" />
      </a>
    </div>
    <div class="wrapper">
      <h1>Snowplow Inspector</h1>
      <p>
        <a
          href="https://snowplow.io/blog/snowplow-acquires-poplin-data/?utm_source=debugger%20extension&utm_medium=software&utm_campaign=Chrome%20extension%20about%20page"
          target="_blank"
        >
          Poplin Data is now Snowplow Australia.
        </a>
      </p>
      <p>
        Snowplow Inspector is a debugger for
        <a href="https://snowplow.io/?utm_source=debugger%20extension&utm_medium=software&utm_campaign=Chrome%20extension%20about%20page">
          Snowplow Behavioral Data Platform
        </a>
        .
      </p>
      <p>
        To use, open Developer Tools and switch to the &ldquo;Snowplow&rdquo;
        tab.
      </p>
      <p>
        <a
          href={`${REPOSITORY_URL}/releases/tag/v${
            chrome.runtime.getManifest().version
          }`}
          target="_blank"
        >
          What's new? Check out the latest Release Notes
        </a>
      </p>
      <p>
        <a href={`${REPOSITORY_URL}/issues`} target="_blank">
          Report problems or request features for the extension
        </a>
      </p>
    </div>
  </>
);

render(<Popup />, document.body);
